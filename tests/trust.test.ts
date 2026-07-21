import { describe, it, expect } from "vitest";
import { VerificationLevel } from "@prisma/client";

import {
  trustBadges,
  checkCanPublish,
  tierLimits,
  TIER_LIMITS,
} from "@/lib/trust";

describe("trustBadges", () => {
  it("returns no badges for a brand-new unverified account", () => {
    expect(
      trustBadges({
        emailVerified: false,
        phoneVerified: false,
        verificationLevel: VerificationLevel.LEVEL_1_BASIC,
        stripeAccountId: null,
      }),
    ).toEqual([]);
  });

  it("grants email + phone when those flags are set", () => {
    expect(
      trustBadges({
        emailVerified: true,
        phoneVerified: true,
        verificationLevel: VerificationLevel.LEVEL_1_BASIC,
        stripeAccountId: null,
      }),
    ).toEqual(["email", "phone"]);
  });

  it("grants the ID badge only at Level 3", () => {
    const base = {
      emailVerified: false,
      phoneVerified: false,
      stripeAccountId: null,
    };
    expect(
      trustBadges({ ...base, verificationLevel: VerificationLevel.LEVEL_2_SELLER }),
    ).not.toContain("id");
    expect(
      trustBadges({
        ...base,
        verificationLevel: VerificationLevel.LEVEL_3_ID_VERIFIED,
      }),
    ).toContain("id");
  });

  it("grants the payment badge when a Stripe account is connected", () => {
    expect(
      trustBadges({
        emailVerified: false,
        phoneVerified: false,
        verificationLevel: VerificationLevel.LEVEL_1_BASIC,
        stripeAccountId: "acct_123",
      }),
    ).toEqual(["payment"]);
  });
});

describe("checkCanPublish — verification-tier selling limits", () => {
  it("blocks a Level 1 seller from exceeding the low active-listing cap", () => {
    const limit = TIER_LIMITS[VerificationLevel.LEVEL_1_BASIC].maxActiveListings;
    const res = checkCanPublish({
      level: VerificationLevel.LEVEL_1_BASIC,
      currentActiveCount: limit,
      price: 10,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("listing_limit_reached");
      expect(res.limit).toBe(limit);
    }
  });

  it("blocks a high-value item above the Level 1 price cap", () => {
    const res = checkCanPublish({
      level: VerificationLevel.LEVEL_1_BASIC,
      currentActiveCount: 0,
      price: 500,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("price_exceeds_tier");
  });

  it("checks price before the listing count", () => {
    // Over both caps → price failure surfaces first (clearer seller guidance).
    const res = checkCanPublish({
      level: VerificationLevel.LEVEL_1_BASIC,
      currentActiveCount: 99,
      price: 9999,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("price_exceeds_tier");
  });

  it("allows a Level 2 seller within their higher caps", () => {
    const res = checkCanPublish({
      level: VerificationLevel.LEVEL_2_SELLER,
      currentActiveCount: 10,
      price: 750,
    });
    expect(res.ok).toBe(true);
  });

  it("never caps a Level 3 (ID-verified) seller", () => {
    const res = checkCanPublish({
      level: VerificationLevel.LEVEL_3_ID_VERIFIED,
      currentActiveCount: 100_000,
      price: 10_000_000,
    });
    expect(res.ok).toBe(true);
    expect(tierLimits(VerificationLevel.LEVEL_3_ID_VERIFIED).maxActiveListings).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});
