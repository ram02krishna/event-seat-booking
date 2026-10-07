import { Queue } from 'bullmq';
import { redisConnection } from '../redis';
import { logger } from '../logger';

export interface HoldExpiryData {
  eventId: string;
  seatIds: string[];
  userId: string;
}

export const holdExpiryQueue = new Queue<HoldExpiryData>('hold-expiry-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

export async function scheduleHoldExpiry(data: HoldExpiryData, delayMs: number) {
  try {
    const job = await holdExpiryQueue.add('expire-seats', data, {
      delay: delayMs,
    });
    logger.info(`Scheduled hold expiry job ${job.id} for event ${data.eventId} in ${delayMs / 1000}s`);
    return job;
  } catch (err) {
    logger.error(err, 'Failed to schedule hold expiry job');
  }
}
