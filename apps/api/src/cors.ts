import { config } from './config';

/**
 * Checks if the request origin matches allowed origins configured in CLIENT_URL.
 * Supports:
 * - Comma-separated domains in CLIENT_URL (e.g. "http://localhost:3000,https://my-app.vercel.app")
 * - Wildcard "*"
 * - Localhost origins during development
 * - Vercel preview/production domains (*.vercel.app) when a vercel.app domain is in CLIENT_URL
 */
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
