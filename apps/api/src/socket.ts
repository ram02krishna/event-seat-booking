import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from './config';
import { logger } from './logger';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.CLIENT_URL,
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected to socket: ${socket.id}`);

    // Join room for specific event
    socket.on('join:event', (eventId: string) => {
      socket.join(`event:${eventId}`);
      logger.info(`Socket ${socket.id} joined room event:${eventId}`);
    });

    // Leave event room
    socket.on('leave:event', (eventId: string) => {
      socket.leave(`event:${eventId}`);
      logger.info(`Socket ${socket.id} left room event:${eventId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
}

export function broadcastSeatsHeld(eventId: string, data: { seatIds: string[]; heldByUserId: string; holdExpiresAt: string }) {
  if (io) {
    io.to(`event:${eventId}`).emit('seats:held', data);
  }
}

export function broadcastSeatsReleased(eventId: string, data: { seatIds: string[] }) {
  if (io) {
    io.to(`event:${eventId}`).emit('seats:released', data);
  }
}

export function broadcastSeatsSold(eventId: string, data: { seatIds: string[] }) {
  if (io) {
    io.to(`event:${eventId}`).emit('seats:sold', data);
  }
}
