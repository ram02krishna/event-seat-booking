import { prisma } from '../db';
import { logger } from '../logger';
import { broadcastSeatsReleased } from '../socket';
import { redisConnection } from '../redis';

export async function cleanupExpiredHolds(): Promise<number> {
  // This single conditional UPDATE is intentionally atomic. A select-then-update can race
  // with a customer re-holding the same seat and incorrectly clear the newer hold.
  const expiredSeats = await prisma.$queryRaw<Array<{ eventId: string; seatId: string }>>`
    UPDATE "EventSeat"
    SET
      status = 'AVAILABLE'::"SeatStatus",
      "heldByUserId" = NULL,
      "holdExpiresAt" = NULL,
      version = version + 1,
      "updatedAt" = NOW()
    WHERE status = 'HELD'::"SeatStatus"
      AND "holdExpiresAt" <= NOW()
    RETURNING "eventId", "seatId";
  `;

  if (expiredSeats.length === 0) return 0;

  // Broadcast only the rows the atomic update actually released.
  const eventMap = new Map<string, string[]>();
  for (const seat of expiredSeats) {
    const list = eventMap.get(seat.eventId) || [];
    list.push(seat.seatId);
    eventMap.set(seat.eventId, list);
  }

  for (const [eventId, seatIds] of eventMap.entries()) {
    broadcastSeatsReleased(eventId, { seatIds });
  }

  redisConnection.del('cache:events:published').catch(() => null);

  logger.info(`Cleanup job tidy-up: released ${expiredSeats.length} expired holds`);
  return expiredSeats.length;
}

export function startPeriodicCleanup(intervalMs = 60000) {
  logger.info(`Starting periodic hold cleanup job every ${intervalMs / 1000}s`);

  const interval = setInterval(() => {
    cleanupExpiredHolds().catch((err) => {
      logger.error(err, 'Error in periodic hold cleanup job');
    });
  }, intervalMs);

  return () => clearInterval(interval);
}
