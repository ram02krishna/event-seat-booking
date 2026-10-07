import http from 'http';
import { app } from './app';
import { config } from './config';
import { logger } from './logger';
import { initSocket } from './socket';

const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

server.listen(config.PORT, () => {
  logger.info(`API server running on http://localhost:${config.PORT}`);
});

function shutdown() {
  logger.info('Shutting down API server...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
