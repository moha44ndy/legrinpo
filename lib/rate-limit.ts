/**
 * Rate limiting en mémoire par IP.
 * Pour une prod multi-instances, utiliser Redis ou un service dédié.
 */

const store = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 10; // requêtes max par fenêtre

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export function checkRateLimit(
  request: Request,
  keyPrefix: string,
  options: RateLimitOptions = {}
): { allowed: boolean; retryAfterMs?: number } {
  const { windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX } = options;
  const ip = getClientIp(request);
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > max) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  return { allowed: true };
}

/** Nettoyer les entrées expirées (à appeler périodiquement si besoin). */
export function pruneStore() {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (now > v.resetAt) store.delete(k);
  }
}
