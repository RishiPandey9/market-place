import { describe, it, expect } from "vitest";

import {
  deviceLabel,
  isNewDevice,
  requestFingerprint,
} from "@/lib/session";

describe("deviceLabel", () => {
  it("labels a Chrome-on-Windows user agent", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
    expect(deviceLabel(ua)).toBe("Chrome on Windows");
  });

  it("distinguishes Edge from Chrome", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0";
    expect(deviceLabel(ua)).toBe("Edge on Windows");
  });

  it("labels Safari on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    expect(deviceLabel(ua)).toBe("Safari on macOS");
  });

  it("falls back for missing user agent", () => {
    expect(deviceLabel(null)).toBe("Unknown device");
    expect(deviceLabel(undefined)).toBe("Unknown device");
  });
});

describe("isNewDevice", () => {
  it("treats the first-ever login as not suspicious", () => {
    expect(isNewDevice([], { ip: "1.2.3.4", userAgent: "UA" })).toBe(false);
  });

  it("flags a login from an unseen ip+ua pair", () => {
    const prior = [{ ip: "1.2.3.4", userAgent: "UA-A" }];
    expect(isNewDevice(prior, { ip: "9.9.9.9", userAgent: "UA-B" })).toBe(true);
  });

  it("does not flag a returning ip+ua pair", () => {
    const prior = [
      { ip: "1.2.3.4", userAgent: "UA-A" },
      { ip: "5.6.7.8", userAgent: "UA-B" },
    ];
    expect(isNewDevice(prior, { ip: "5.6.7.8", userAgent: "UA-B" })).toBe(false);
  });

  it("treats a same-ip but different-ua login as new", () => {
    const prior = [{ ip: "1.2.3.4", userAgent: "UA-A" }];
    expect(isNewDevice(prior, { ip: "1.2.3.4", userAgent: "UA-B" })).toBe(true);
  });
});

describe("requestFingerprint", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const fp = requestFingerprint({
      "x-forwarded-for": "203.0.113.5, 70.41.3.18",
      "user-agent": "UA",
    });
    expect(fp.ip).toBe("203.0.113.5");
    expect(fp.userAgent).toBe("UA");
  });

  it("falls back to x-real-ip", () => {
    const fp = requestFingerprint({ "x-real-ip": "198.51.100.7" });
    expect(fp.ip).toBe("198.51.100.7");
    expect(fp.userAgent).toBeNull();
  });

  it("returns nulls when no headers present", () => {
    expect(requestFingerprint(undefined)).toEqual({ ip: null, userAgent: null });
    expect(requestFingerprint({})).toEqual({ ip: null, userAgent: null });
  });
});
