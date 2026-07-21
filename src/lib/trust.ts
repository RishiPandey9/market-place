import { VerificationLevel } from "@prisma/client";

// ==============================================================
// Trust badges + verification-tier limits (Phase 1.2)
// ==============================================================
// Pure functions only (no DB, no network) so they are unit-testable per
// CLAUDE.md hard-constraint #7. Pages/routes load the relevant User fields and
// compose these; nothing here touches Prisma.
//
// Two related concerns live together because they read from the same identity
// signals on the User model:
//   1. Trust badges — the visible "email / phone / ID / payment verified" chips
//      shown on the seller profile and listing pages (SOW 1.2).
//   2. Tier limits — the selling / active-listing ceilings tied to a user's
//      verification level (SOW 1.2 "selling/withdrawal limits tied to tier").
// The withdrawal gate itself lives in escrow.ts; this module covers the
// *selling*-side limits, which the withdrawal gate does not.

// --------------------------------------------------------------
// Trust badges
// --------------------------------------------------------------
export type TrustBadge = "email" | "phone" | "id" | "payment";

// The subset of User fields the badge derivation needs. Kept structural so both
// server components and tests can pass a plain object.
export type TrustSignals = {
  emailVerified: boolean;
  phoneVerified: boolean;
  verificationLevel: VerificationLevel;
  stripeAccountId: string | null;
};

// Which identity signals a user has proven. ID is granted at Level 3; payment is
// proven by having connected a Stripe payout account.
export function trustBadges(signals: TrustSignals): TrustBadge[] {
  const badges: TrustBadge[] = [];
  if (signals.emailVerified) badges.push("email");
  if (signals.phoneVerified) badges.push("phone");
  if (signals.verificationLevel === VerificationLevel.LEVEL_3_ID_VERIFIED) {
    badges.push("id");
  }
  if (signals.stripeAccountId) badges.push("payment");
  return badges;
}

export const BADGE_LABELS: Record<TrustBadge, string> = {
  email: "Email verified",
  phone: "Phone verified",
  id: "ID verified",
  payment: "Payment verified",
};

// --------------------------------------------------------------
// Verification-tier selling limits (SOW 1.2)
// --------------------------------------------------------------
// Higher verification unlocks higher selling capacity. These are anti-fraud
// throttles on unverified accounts, not billing tiers — a brand-new Level 1
// account can list a little, a Level 2 seller (payout connected) a lot, and a
// fully ID-verified Level 3 seller is effectively uncapped.
//
// `maxActiveListings` caps how many ACTIVE listings a seller may have at once.
// `maxListingPrice` caps the price of any single item (high-value items require
// stronger identity assurance). Infinity == no cap. Single source of truth —
// adjust here rather than sprinkling magic numbers across routes.
export type TierLimits = {
  maxActiveListings: number;
  maxListingPrice: number;
};

export const TIER_LIMITS: Record<VerificationLevel, TierLimits> = {
  [VerificationLevel.LEVEL_1_BASIC]: {
    maxActiveListings: 3,
    maxListingPrice: 100,
  },
  [VerificationLevel.LEVEL_2_SELLER]: {
    maxActiveListings: 50,
    maxListingPrice: 1_000,
  },
  [VerificationLevel.LEVEL_3_ID_VERIFIED]: {
    maxActiveListings: Number.POSITIVE_INFINITY,
    maxListingPrice: Number.POSITIVE_INFINITY,
  },
};

export function tierLimits(level: VerificationLevel): TierLimits {
  return TIER_LIMITS[level];
}

export type SellDenyReason = "listing_limit_reached" | "price_exceeds_tier";

export type SellCheck =
  | { ok: true }
  | { ok: false; reason: SellDenyReason; limit: number };

// Decide whether a seller at `level` may publish (make ACTIVE) another listing
// at `price`, given how many ACTIVE listings they already have. Only ACTIVE
// listings count against the cap — DRAFT/HIDDEN/SOLD do not consume capacity.
// A DRAFT save bypasses this entirely (the route only checks on publish).
export function checkCanPublish(params: {
  level: VerificationLevel;
  currentActiveCount: number;
  price: number;
}): SellCheck {
  const limits = tierLimits(params.level);

  if (params.price > limits.maxListingPrice) {
    return {
      ok: false,
      reason: "price_exceeds_tier",
      limit: limits.maxListingPrice,
    };
  }
  if (params.currentActiveCount >= limits.maxActiveListings) {
    return {
      ok: false,
      reason: "listing_limit_reached",
      limit: limits.maxActiveListings,
    };
  }
  return { ok: true };
}
