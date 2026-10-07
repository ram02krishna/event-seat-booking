import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { logger } from './logger';
import { errorHandler, notFoundHandler } from './errors';
import { HealthResponse } from '@repo/shared';
import { attachUser } from './middleware/auth';
import { authRouter } from './routes/auth.routes';
import { eventsRouter } from './routes/events.routes';
import { organizerRouter } from './routes/organizer.routes';

export const app = express();

app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Health check
app.get('/health', (_req, res) => {
  const data: HealthResponse = {
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(data);
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/organizer', organizerRouter);

// 404 & error handlers
app.use(notFoundHandler);
app.use(errorHandler);
