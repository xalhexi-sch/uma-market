/**
 * Simple in-memory rate limiter for Server Actions.
 *
 * For production with multiple Vercel instances, replace with
 * Upstash Redis (@upstash/ratelimit) for distributed rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is within the rate limit.
 *
 * @param key - Unique identifier (e.g., `checkout:${userId}`)
 * @param limit - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ── Pre-configured rate limiters ─────────────────────

/** Checkout: 10 attempts per minute per user */
export function checkoutRateLimit(userId: string): RateLimitResult {
  return rateLimit(`checkout:${userId}`, 10, 60_000);
}

/** Messages: 50 messages per minute per user */
export function messageRateLimit(userId: string): RateLimitResult {
  return rateLimit(`message:${userId}`, 50, 60_000);
}

/** Product creation: 20 products per 5 minutes per user */
export function productCreateRateLimit(userId: string): RateLimitResult {
  return rateLimit(`product-create:${userId}`, 20, 300_000);
}

/** Reviews: 10 submissions per minute per user (seller + product reviews share one budget) */
export function reviewRateLimit(userId: string): RateLimitResult {
  return rateLimit(`review:${userId}`, 10, 60_000);
}

/** Onboarding: 5 attempts per 5 minutes per user */
export function onboardingRateLimit(userId: string): RateLimitResult {
  return rateLimit(`onboarding:${userId}`, 5, 300_000);
}

/** General API: 100 requests per minute per user */
export function generalRateLimit(userId: string): RateLimitResult {
  return rateLimit(`general:${userId}`, 100, 60_000);
}
