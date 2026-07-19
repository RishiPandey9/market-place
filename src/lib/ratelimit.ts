// In-memory sliding-window rate limiter (Phase 2 security hardening).
//
// This is a per-instance limiter: it protects a single Node process and is the
// interim implementation until a shared store (Redis/Upstash) is wired in for
// multi-instance deploys. It is intentionally dependency-free so it can run
// inside route handlers without adding to the approved stack.
//
// INTERIM: on Vercel/serverless with >1 instance, counters are not shared
// across instances — swap `hits` for a Redis-backed store before public launch.

type Bucket = { timestamps: number[] };

// Module-level store survives across requests within one process/instance.
const buckets = new Map<string, Bucket>();

export type RateLimitRule = {
  /** Max requests permitted within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Requests remaining in the current window (0 when blocked). */
  remaining: number;
  /** Unix ms timestamp when the window frees up enough for one more request. */
  resetAt: number;
  limit: number;
};

// Named rules for the routes we protect. Keep these conservative — they guard
// auth and money endpoints against brute force and abuse, not normal use.
export const RATE_LIMITS = {
  // Login/credential attempts: 10 per 15 min per IP.
  auth: { limit: 10, windowMs: 15 * 60 * 1000 },
  // Registration: 5 new accounts per hour per IP.
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  // Money movement: 5 withdrawal attempts per hour per user.
  withdraw: { limit: 5, windowMs: 60 * 60 * 1000 },
  // Dispute creation: 10 per hour per user.
  dispute: { limit: 10, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Pure sliding-window check against a supplied clock. Extracted so it can be
 * unit-tested deterministically without relying on wall-clock time.
 */
export function evaluate(
  bucket: Bucket,
  rule: RateLimitRule,
  now: number,
): RateLimitResult {
  const windowStart = now - rule.windowMs;
  // Drop timestamps that have aged out of the window.
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= rule.limit) {
    const oldest = bucket.timestamps[0];
    return {
      ok: false,
      remaining: 0,
      resetAt: oldest + rule.windowMs,
      limit: rule.limit,
    };
  }

  bucket.timestamps.push(now);
  return {
    ok: true,
    remaining: rule.limit - bucket.timestamps.length,
    resetAt: now + rule.windowMs,
    limit: rule.limit,
  };
}

/**
 * Record a hit for `key` under `rule` and report whether it is allowed.
 * `key` should combine the rule name and the caller identity, e.g.
 * `auth:1.2.3.4` or `withdraw:user-123`.
 */
export function rateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitResult {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  const result = evaluate(bucket, rule, now);
  // Opportunistic cleanup: forget fully-drained buckets so the map can't grow
  // unbounded from one-off keys.
  if (bucket.timestamps.length === 0) buckets.delete(key);
  return result;
}

/** Test-only: clear all buckets between cases. */
export function __resetRateLimitStore() {
  buckets.clear();
}

/**
 * Standard headers to attach to a rate-limited response so clients can back
 * off. `Retry-After` is in whole seconds per the HTTP spec.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const retryAfterSec = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000));
  return {
    "Retry-After": String(retryAfterSec),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
