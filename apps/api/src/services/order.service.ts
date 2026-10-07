import crypto from 'crypto';
import qrcode from 'qrcode';
import { prisma } from '../db';
import { AppError } from '../errors';
import { logger } from '../logger';
import { broadcastSeatsSold } from '../socket';
import { sendTicketConfirmationEmail } from './email.service';

/**
 * Finalizes an order by marking held seats as SOLD and creating Ticket records.
 * Designed as a single function so a payment webhook or direct checkout can invoke it.
 */
export async function finalizeOrder(orderId: string) {
  const finalized = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        event: { include: { venue: true } },
        user: true,
        tickets: {
          include: {
            eventSeat: { include: { seat: true } },
          },
        },
      },
    });

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    // Idempotency: if already confirmed, return existing tickets
    if (order.status === 'CONFIRMED') {
      return {
        order,
        tickets: order.tickets,
        user: order.user,
        event: order.event,
        alreadyConfirmed: true,
      };
    }

    if (order.status !== 'PENDING') {
      throw new AppError(400, `Cannot finalize order with status ${order.status}`);
    }

    // Find the held event seats for this user and event
    const heldSeats = await tx.eventSeat.findMany({
      where: {
        eventId: order.eventId,
        heldByUserId: order.userId,
        status: 'HELD',
      },
      include: { seat: true },
    });

    if (heldSeats.length === 0) {
      throw new AppError(400, 'No active held seats found to confirm');
    }

    // Mark seats SOLD
    const updateResult = await tx.eventSeat.updateMany({
      where: {
        id: { in: heldSeats.map((s) => s.id) },
        status: 'HELD',
        heldByUserId: order.userId,
      },
      data: {
        status: 'SOLD',
        heldByUserId: null,
        holdExpiresAt: null,
        version: { increment: 1 },
      },
    });

    if (updateResult.count !== heldSeats.length) {
      throw new AppError(409, 'One or more seat holds expired before confirmation');
    }

    // Update order status to CONFIRMED
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED' },
    });

    // Generate unique tickets with cryptographic QR tokens
    const createdTickets = [];
    for (const es of heldSeats) {
      const qrToken = crypto.randomUUID();
      const ticket = await tx.ticket.create({
        data: {
          orderId: order.id,
          eventSeatId: es.id,
          qrToken,
        },
        include: {
          eventSeat: { include: { seat: true } },
        },
      });
      createdTickets.push(ticket);
    }

    return {
      order: updatedOrder,
      tickets: createdTickets,
      user: order.user,
      event: order.event,
      alreadyConfirmed: false,
    };
  });

  // Generate QR code base64 Data URLs
  const ticketsWithQRs = await Promise.all(
    finalized.tickets.map(async (t) => {
      const qrDataUrl = await qrcode.toDataURL(t.qrToken, { width: 300, margin: 2 });
      return {
        id: t.id,
        orderId: t.orderId,
        eventSeatId: t.eventSeatId,
        qrToken: t.qrToken,
        checkedInAt: t.checkedInAt,
        createdAt: t.createdAt,
        seat: t.eventSeat.seat,
        price: t.eventSeat.price,
        qrDataUrl,
      };
    })
  );

  // If this was a fresh confirmation, broadcast real-time event and send email
  if (!finalized.alreadyConfirmed) {
    broadcastSeatsSold(finalized.order.eventId, {
      seatIds: finalized.tickets.map((t) => t.eventSeat.seatId),
    });

    sendTicketConfirmationEmail({
      toEmail: finalized.user.email,
      orderId: finalized.order.id,
      eventTitle: finalized.event.title,
      startsAt: finalized.event.startsAt,
      venueName: finalized.event.venue.name,
      tickets: ticketsWithQRs.map((t) => ({
        ticketId: t.id,
        qrToken: t.qrToken,
        seatLabel: `Row ${t.seat.row}, Seat ${t.seat.number}`,
        tier: t.seat.tier,
        priceCents: t.price,
        qrDataUrl: t.qrDataUrl,
      })),
    }).catch((err) => logger.error(err, 'Error in sendTicketConfirmationEmail'));
  }

  return {
    order: finalized.order,
    tickets: ticketsWithQRs,
  };
}

export async function createAndConfirmBooking(params: {
  eventId: string;
  seatIds: string[];
  userId: string;
  idempotencyKey?: string;
}) {
  const { eventId, seatIds, userId, idempotencyKey } = params;

  // 1. Idempotency Key check: if an order already exists with this key, return it
  if (idempotencyKey) {
    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey },
    });

    if (existingOrder) {
      logger.info(`Idempotent order replay for key ${idempotencyKey}`);
      return finalizeOrder(existingOrder.id);
    }
  }

  // 2. Verify seats are currently HELD by this user
  const heldSeats = await prisma.eventSeat.findMany({
    where: {
      eventId,
      heldByUserId: userId,
      status: 'HELD',
      holdExpiresAt: { gt: new Date() },
      OR: [
        { seatId: { in: seatIds } },
        { id: { in: seatIds } },
      ],
    },
  });

  if (heldSeats.length !== seatIds.length) {
    throw new AppError(400, 'All seats must be actively held by you before confirming booking');
  }

  const totalCents = heldSeats.reduce((sum, s) => sum + s.price, 0);

  // 3. Create PENDING Order
  const order = await prisma.order.create({
    data: {
      userId,
      eventId,
      status: 'PENDING',
      totalCents,
      idempotencyKey: idempotencyKey || null,
    },
  });

  // 4. Finalize order (mark SOLD + create tickets)
  return finalizeOrder(order.id);
}
