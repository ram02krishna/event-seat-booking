import { config } from './config';

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const rawOrigins = config.CLIENT_URL || 'http://localhost:3000';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    return true;
  }

  // Allow localhost, 127.0.0.1, and private LAN IP addresses in development
  if (
    config.NODE_ENV !== 'production' &&
    (/^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
      /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin))
  ) {
    return true;
  }

  // Allow Vercel preview deployments if vercel.app is configured in CLIENT_URL
  const hasVercelAllowed = allowedOrigins.some((o) => o.includes('.vercel.app'));
  if (hasVercelAllowed && /^https:\/\/[a-zA-Z0-9_\-.]+\.vercel\.app$/.test(origin)) {
    return true;
  }

  return false;
}
