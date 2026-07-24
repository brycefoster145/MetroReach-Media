/**
 * Rate Limiter — Simple in-memory rate limiter.
 * MetroReach Digital
 *
 * Uses a Map to track request counts per IP within sliding windows.
 * Not distributed — each serverless instance has its own state.
 * Sufficient for low-volume abuse prevention.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Check whether a request from the given key is allowed.
 * Returns remaining count (0 if rate limited).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  if (entry.count > limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - entry.count };
}

/**
 * Extract client IP from request headers.
 * Uses x-forwarded-for (Vercel), falls back to "unknown".
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return "unknown";
}

/**
 * Simple cleanup: remove expired entries.
 * Call periodically or on each request (cheap for small maps).
 */
function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

// Run cleanup every 60 seconds to prevent memory leaks
setInterval(cleanup, 60_000).unref();
