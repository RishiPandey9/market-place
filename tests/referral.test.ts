import { describe, it, expect } from "vitest";

import {
  normalizeReferralCode,
  isValidReferralCodeFormat,
  generateReferralCode,
  canApplyReferral,
} from "@/lib/referral";

describe("normalizeReferralCode", () => {
  it("uppercases and strips whitespace and dashes", () => {
    expect(normalizeReferralCode(" abcd-1234 ")).toBe("ABCD1234");
    expect(normalizeReferralCode("ab cd 12 34")).toBe("ABCD1234");
  });
});

describe("isValidReferralCodeFormat", () => {
  it("accepts a well-formed 8-char code", () => {
    expect(isValidReferralCodeFormat("ABCD2345")).toBe(true);
  });

  it("accepts a code that only needs normalizing", () => {
    expect(isValidReferralCodeFormat("abcd-2345")).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(isValidReferralCodeFormat("ABC234")).toBe(false);
    expect(isValidReferralCodeFormat("ABCD23456")).toBe(false);
  });

  it("rejects ambiguous/forbidden characters", () => {
    expect(isValidReferralCodeFormat("ABCD01OI")).toBe(false); // 0,1,O,I excluded
  });
});

describe("generateReferralCode", () => {
  it("produces a valid 8-char code from the safe alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode();
      expect(code).toHaveLength(8);
      expect(isValidReferralCodeFormat(code)).toBe(true);
      expect(code).not.toMatch(/[01OI]/);
    }
  });
});

describe("canApplyReferral", () => {
  it("allows applying when the user has no code of their own yet", () => {
    expect(
      canApplyReferral({ referrerCode: "ABCD2345", referredOwnCode: null }),
    ).toBe(true);
  });

  it("blocks self-referral regardless of formatting", () => {
    expect(
      canApplyReferral({
        referrerCode: "abcd-2345",
        referredOwnCode: "ABCD2345",
      }),
    ).toBe(false);
  });

  it("allows applying a different user's code", () => {
    expect(
      canApplyReferral({
        referrerCode: "ABCD2345",
        referredOwnCode: "WXYZ6789",
      }),
    ).toBe(true);
  });
});
