import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { AppError } from '../errors';

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
  const heldSeats = await prisma.$transaction(async (tx) => {
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

    if (existingUserHolds.length > 0) {
      // Allow idempotent retry if holding the exact same seats
      const existingIdSet = new Set(existingUserHolds.flatMap((h) => [h.id, h.seatId]));
      const isSameHold = sortedIds.every((id) => existingIdSet.has(id));

      if (!isSameHold) {
        throw new AppError(400, 'You already have an active seat hold for this event');
      }
    }

    // Atomic conditional UPDATE:
    // Only take seats that are AVAILABLE or whose hold has already expired.
    // Expired holds count as available inside the query itself.
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
          OR (status = 'HELD'::"SeatStatus" AND "holdExpiresAt" < NOW())
        )
      RETURNING id, "seatId", price;
    `;

    // All-or-nothing check: if any requested seat wasn't acquired, rollback
    if (updatedRows.length !== sortedIds.length) {
      throw new AppError(409, 'One or more selected seats are no longer available');
    }

    return updatedRows;
  });

  return {
    eventId,
    heldSeats,
    holdExpiresAt,
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
