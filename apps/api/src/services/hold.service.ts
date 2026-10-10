import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { AppError } from '../errors';
import { scheduleHoldExpiry } from '../jobs/holdExpiry.queue';

const HOLD_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export async function holdSeats(params: {
  eventId: string;
  seatIds: string[];
  userId: string;
  idempotencyKey?: string;
}) {
  const { eventId, seatIds, userId } = params;

  if (seatIds.length === 0) {
    throw new AppError(400, 'Select at least one seat');
  }

  if (seatIds.length > 6) {
    throw new AppError(400, 'Maximum 6 seats per hold');
  }

  // Sort seatIds to prevent deadlocks when concurrent users request overlapping seats
  const sortedIds = [...new Set(seatIds)].sort();
  const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);

  // Check event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });
  if (!event || event.status !== 'PUBLISHED') {
    throw new AppError(404, 'Event not found or not open for booking');
  }

  // Run hold query inside transaction for all-or-nothing atomicity
  const { heldSeats, releasedSeatIds } = await prisma.$transaction(async (tx) => {
    // One active hold per user per event check
    const existingUserHolds = await tx.eventSeat.findMany({
      where: {
        eventId,
        heldByUserId: userId,
        status: 'HELD',
        holdExpiresAt: { gt: new Date() },
      },
      select: { id: true, seatId: true },
    });

    const releasedSeatIds: string[] = [];

    if (existingUserHolds.length > 0) {
      // Find seats that were held by this user previously but are NOT in the current request
      const seatsToRelease = existingUserHolds.filter(
        (h) => !sortedIds.includes(h.id) && !sortedIds.includes(h.seatId)
      );

      if (seatsToRelease.length > 0) {
        await tx.eventSeat.updateMany({
          where: {
            id: { in: seatsToRelease.map((s) => s.id) },
            heldByUserId: userId,
            status: 'HELD',
          },
          data: {
            status: 'AVAILABLE',
            heldByUserId: null,
            holdExpiresAt: null,
            version: { increment: 1 },
          },
        });
        releasedSeatIds.push(...seatsToRelease.map((s) => s.seatId));
      }
    }

    // Atomic conditional UPDATE:
    // Only take seats that are AVAILABLE, whose hold has already expired,
    // OR are already held by this user (allows refreshing/extending hold or re-selecting own seats).
    const updatedRows = await tx.$queryRaw<Array<{ id: string; seatId: string; price: number }>>`
      UPDATE "EventSeat"
      SET 
        status = 'HELD'::"SeatStatus",
        "heldByUserId" = ${userId},
        "holdExpiresAt" = ${holdExpiresAt},
        version = version + 1,
        "updatedAt" = NOW()
      WHERE "eventId" = ${eventId}
        AND ("seatId" IN (${Prisma.join(sortedIds)}) OR id IN (${Prisma.join(sortedIds)}))
        AND (
          status = 'AVAILABLE'::"SeatStatus"
          OR (
            status = 'HELD'::"SeatStatus"
            AND ("holdExpiresAt" < NOW() OR "heldByUserId" = ${userId})
          )
        )
      RETURNING id, "seatId", price;
    `;

    // All-or-nothing check: if any requested seat wasn't acquired, rollback
    if (updatedRows.length !== sortedIds.length) {
      throw new AppError(409, 'One or more selected seats are no longer available');
    }

    return { heldSeats: updatedRows, releasedSeatIds };
  });

  // Schedule delayed BullMQ job to automatically release seats if not confirmed
  await scheduleHoldExpiry(
    {
      eventId,
      seatIds: heldSeats.map((s) => s.seatId),
      userId,
    },
    HOLD_DURATION_MS
  );

  return {
    eventId,
    heldSeats,
    holdExpiresAt,
    releasedSeatIds,
  };
}

export async function releaseSeats(params: {
  eventId: string;
  seatIds: string[];
  userId: string;
}) {
  const { eventId, seatIds, userId } = params;
  const ids = [...new Set(seatIds)];

  if (ids.length === 0) {
    return { releasedCount: 0 };
  }

  const updatedRows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "EventSeat"
    SET 
      status = 'AVAILABLE'::"SeatStatus",
      "heldByUserId" = NULL,
      "holdExpiresAt" = NULL,
      version = version + 1,
      "updatedAt" = NOW()
    WHERE "eventId" = ${eventId}
      AND "heldByUserId" = ${userId}
      AND ("seatId" IN (${Prisma.join(ids)}) OR id IN (${Prisma.join(ids)}))
      AND status = 'HELD'::"SeatStatus"
    RETURNING id;
  `;

  return { releasedCount: updatedRows.length };
}
