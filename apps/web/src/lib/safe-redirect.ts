/**
 * Only allow same-site relative paths as post-login redirect targets.
 * Blocks `https://evil.com`, `//evil.com` and `/\evil.com` style open redirects.
 */
export function safeRedirect(target: string | null | undefined, fallback = '/'): string {
  if (!target) return fallback;
  if (!target.startsWith('/')) return fallback;
  if (target.startsWith('//') || target.startsWith('/\\')) return fallback;
  return target;
}
