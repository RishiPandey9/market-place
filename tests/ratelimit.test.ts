import { describe, it, expect, beforeEach } from "vitest";

import {
  rateLimit,
  evaluate,
  rateLimitHeaders,
  RATE_LIMITS,
  __resetRateLimitStore,
} from "@/lib/ratelimit";
import { clientIp } from "@/lib/audit";

describe("rate limiter (sliding window)", () => {
  beforeEach(() => __resetRateLimitStore());

  it("allows requests up to the limit, then blocks", () => {
    const rule = { limit: 3, windowMs: 1000 };
    const key = "test:a";
    const now = 1_000_000;
    expect(rateLimit(key, rule, now).ok).toBe(true);
    expect(rateLimit(key, rule, now).ok).toBe(true);
    expect(rateLimit(key, rule, now).ok).toBe(true);
    const blocked = rateLimit(key, rule, now);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("reports decreasing remaining count", () => {
    const rule = { limit: 3, windowMs: 1000 };
    const now = 5_000;
    expect(rateLimit("test:b", rule, now).remaining).toBe(2);
    expect(rateLimit("test:b", rule, now).remaining).toBe(1);
    expect(rateLimit("test:b", rule, now).remaining).toBe(0);
  });

  it("frees up capacity once the window slides past old hits", () => {
    const rule = { limit: 2, windowMs: 1000 };
    const key = "test:c";
    expect(rateLimit(key, rule, 0).ok).toBe(true);
    expect(rateLimit(key, rule, 500).ok).toBe(true);
    // Third request within the window is blocked.
    expect(rateLimit(key, rule, 900).ok).toBe(false);
    // After the first hit ages out (>1000ms since t=0), room opens up.
    expect(rateLimit(key, rule, 1100).ok).toBe(true);
  });

  it("isolates counters per key", () => {
    const rule = { limit: 1, windowMs: 1000 };
    expect(rateLimit("test:user1", rule, 0).ok).toBe(true);
    expect(rateLimit("test:user2", rule, 0).ok).toBe(true);
    // Same key is now exhausted.
    expect(rateLimit("test:user1", rule, 0).ok).toBe(false);
  });

  it("evaluate computes resetAt from the oldest in-window hit", () => {
    const rule = { limit: 1, windowMs: 1000 };
    const bucket = { timestamps: [] as number[] };
    evaluate(bucket, rule, 200); // records hit at t=200
    const blocked = evaluate(bucket, rule, 300);
    expect(blocked.ok).toBe(false);
    // Oldest hit (200) + window (1000) = 1200.
    expect(blocked.resetAt).toBe(1200);
  });

  it("real rules are conservative money/auth guards", () => {
    expect(RATE_LIMITS.register.limit).toBeLessThanOrEqual(5);
    expect(RATE_LIMITS.withdraw.limit).toBeLessThanOrEqual(5);
    expect(RATE_LIMITS.auth.windowMs).toBeGreaterThan(0);
  });

  it("rateLimitHeaders emits Retry-After and limit metadata", () => {
    const result = { ok: false, remaining: 0, resetAt: Date.now() + 5000, limit: 5 };
    const headers = rateLimitHeaders(result);
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
    expect(headers["X-RateLimit-Limit"]).toBe("5");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });
});

describe("clientIp extraction", () => {
  it("takes the first entry of x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" });
    expect(clientIp(h)).toBe("1.2.3.4");
  });

  it("trims whitespace around the forwarded IP", () => {
    const h = new Headers({ "x-forwarded-for": "  9.9.9.9  " });
    expect(clientIp(h)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "5.6.7.8" });
    expect(clientIp(h)).toBe("5.6.7.8");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
