import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';

const redisUrl = config.REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redisConnection.on('connect', () => {
  logger.info('Connected to Redis');
});

redisConnection.on('error', (err) => {
  logger.error(err, 'Redis connection error');
});
