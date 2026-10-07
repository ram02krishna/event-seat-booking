import http from 'http';
import { app } from './app';
import { config } from './config';
import { logger } from './logger';
import { initSocket } from './socket';
import { startHoldExpiryWorker } from './jobs/holdExpiry.worker';
import { startPeriodicCleanup } from './jobs/cleanup.job';
import { redisConnection } from './redis';

const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Start BullMQ worker & periodic cleanup
const worker = startHoldExpiryWorker();
const stopCleanup = startPeriodicCleanup(60000);

server.listen(config.PORT, () => {
  logger.info(`API server running on http://localhost:${config.PORT}`);
});

async function shutdown() {
  logger.info('Shutting down API server...');
  stopCleanup();
  await worker.close();
  await redisConnection.quit();

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
