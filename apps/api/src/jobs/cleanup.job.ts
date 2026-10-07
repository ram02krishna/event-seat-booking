import { prisma } from '../db';
import { logger } from '../logger';
import { broadcastSeatsReleased } from '../socket';

export async function cleanupExpiredHolds(): Promise<number> {
  const now = new Date();

  // Find all stray expired holds across the database
  const expiredSeats = await prisma.eventSeat.findMany({
    where: {
      status: 'HELD',
      holdExpiresAt: { lt: now },
    },
    select: { id: true, eventId: true, seatId: true },
  });

  if (expiredSeats.length === 0) {
    return 0;
  }

  // Reset all expired seats to AVAILABLE
  await prisma.eventSeat.updateMany({
    where: { id: { in: expiredSeats.map((s) => s.id) } },
    data: {
      status: 'AVAILABLE',
      heldByUserId: null,
      holdExpiresAt: null,
      version: { increment: 1 },
    },
  });

  // Group by eventId and broadcast release to relevant rooms
  const eventMap = new Map<string, string[]>();
  for (const s of expiredSeats) {
    const list = eventMap.get(s.eventId) || [];
    list.push(s.seatId);
    eventMap.set(s.eventId, list);
  }

  for (const [eventId, seatIds] of eventMap.entries()) {
    broadcastSeatsReleased(eventId, { seatIds });
  }

  logger.info(`Cleanup job tidy-up: released ${expiredSeats.length} stray expired holds`);
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
