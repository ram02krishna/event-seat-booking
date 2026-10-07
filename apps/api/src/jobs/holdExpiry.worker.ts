import { Worker, Job } from 'bullmq';
import { redisConnection } from '../redis';
import { prisma } from '../db';
import { logger } from '../logger';
import { broadcastSeatsReleased } from '../socket';
import { HoldExpiryData } from './holdExpiry.queue';

export function startHoldExpiryWorker(): Worker {
  const worker = new Worker<HoldExpiryData>(
    'hold-expiry-queue',
    async (job: Job<HoldExpiryData>) => {
      const { eventId, seatIds, userId } = job.data;
      logger.info(`Processing hold expiry job ${job.id} for event ${eventId}`);

      const now = new Date();

      // Find seats that are STILL held by this user and expired
      const expiredSeats = await prisma.eventSeat.findMany({
        where: {
          eventId,
          seatId: { in: seatIds },
          heldByUserId: userId,
          status: 'HELD',
          holdExpiresAt: { lte: now },
        },
        select: { id: true, seatId: true },
      });

      if (expiredSeats.length === 0) {
        logger.info(`No expired seats found for job ${job.id} (already confirmed or released)`);
        return;
      }

      // Reset expired seats back to AVAILABLE
      await prisma.eventSeat.updateMany({
        where: { id: { in: expiredSeats.map((s) => s.id) } },
        data: {
          status: 'AVAILABLE',
          heldByUserId: null,
          holdExpiresAt: null,
          version: { increment: 1 },
        },
      });

      const releasedSeatIds = expiredSeats.map((s) => s.seatId);

      // Broadcast real-time release to all clients viewing the seat map
      broadcastSeatsReleased(eventId, { seatIds: releasedSeatIds });

      logger.info(`Released ${releasedSeatIds.length} expired seats for event ${eventId}`);
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Hold expiry job failed');
  });

  return worker;
}
