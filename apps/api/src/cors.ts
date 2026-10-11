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

  // Allow any localhost port in development
  if (config.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
    return true;
  }

  // Allow Vercel preview deployments if vercel.app is configured in CLIENT_URL
  const hasVercelAllowed = allowedOrigins.some((o) => o.includes('.vercel.app'));
  if (hasVercelAllowed && /^https:\/\/[a-zA-Z0-9_\-.]+\.vercel\.app$/.test(origin)) {
    return true;
  }

  return false;
}
