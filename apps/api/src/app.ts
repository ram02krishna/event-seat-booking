import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { logger } from './logger';
import { errorHandler, notFoundHandler } from './errors';
import { HealthResponse } from '@repo/shared';

export const app = express();

app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

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

// 404 & error handlers
app.use(notFoundHandler);
app.use(errorHandler);
