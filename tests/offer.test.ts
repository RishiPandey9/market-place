import { describe, it, expect } from "vitest";
import { OfferStatus } from "@prisma/client";

import {
  isTerminal,
  awaitingParty,
  canAct,
  nextStatus,
  isValidOfferAmount,
  isExpired,
  offerExpiry,
  OFFER_TTL_HOURS,
} from "@/lib/offer";

describe("isTerminal", () => {
  it("treats accepted/declined/expired/withdrawn as terminal", () => {
    expect(isTerminal(OfferStatus.ACCEPTED)).toBe(true);
    expect(isTerminal(OfferStatus.DECLINED)).toBe(true);
    expect(isTerminal(OfferStatus.EXPIRED)).toBe(true);
    expect(isTerminal(OfferStatus.WITHDRAWN)).toBe(true);
  });

  it("treats pending/countered as non-terminal", () => {
    expect(isTerminal(OfferStatus.PENDING)).toBe(false);
    expect(isTerminal(OfferStatus.COUNTERED)).toBe(false);
  });
});

describe("awaitingParty", () => {
  it("PENDING awaits the seller (buyer just proposed)", () => {
    expect(awaitingParty(OfferStatus.PENDING)).toBe("seller");
  });

  it("COUNTERED awaits the buyer (seller just countered)", () => {
    expect(awaitingParty(OfferStatus.COUNTERED)).toBe("buyer");
  });

  it("returns null on terminal statuses", () => {
    expect(awaitingParty(OfferStatus.ACCEPTED)).toBeNull();
    expect(awaitingParty(OfferStatus.WITHDRAWN)).toBeNull();
  });
});

describe("canAct", () => {
  it("lets the seller accept/decline/counter a PENDING offer", () => {
    expect(canAct(OfferStatus.PENDING, "seller", "accept")).toBe(true);
    expect(canAct(OfferStatus.PENDING, "seller", "decline")).toBe(true);
    expect(canAct(OfferStatus.PENDING, "seller", "counter")).toBe(true);
  });

  it("does NOT let the buyer accept their own PENDING offer", () => {
    expect(canAct(OfferStatus.PENDING, "buyer", "accept")).toBe(false);
    expect(canAct(OfferStatus.PENDING, "buyer", "counter")).toBe(false);
  });

  it("lets the buyer (proposer) withdraw their PENDING offer, but not the seller", () => {
    expect(canAct(OfferStatus.PENDING, "buyer", "withdraw")).toBe(true);
    expect(canAct(OfferStatus.PENDING, "seller", "withdraw")).toBe(false);
  });

  it("lets the buyer accept/decline/counter a COUNTERED offer", () => {
    expect(canAct(OfferStatus.COUNTERED, "buyer", "accept")).toBe(true);
    expect(canAct(OfferStatus.COUNTERED, "buyer", "decline")).toBe(true);
    expect(canAct(OfferStatus.COUNTERED, "buyer", "counter")).toBe(true);
  });

  it("lets the seller (proposer of the counter) withdraw a COUNTERED offer, but not the buyer", () => {
    expect(canAct(OfferStatus.COUNTERED, "seller", "withdraw")).toBe(true);
    expect(canAct(OfferStatus.COUNTERED, "buyer", "withdraw")).toBe(false);
  });

  it("forbids any action on a terminal offer", () => {
    for (const action of ["accept", "decline", "counter", "withdraw"] as const) {
      expect(canAct(OfferStatus.ACCEPTED, "seller", action)).toBe(false);
      expect(canAct(OfferStatus.DECLINED, "buyer", action)).toBe(false);
    }
  });
});

describe("nextStatus", () => {
  it("maps each action to its resulting status", () => {
    expect(nextStatus("accept")).toBe(OfferStatus.ACCEPTED);
    expect(nextStatus("decline")).toBe(OfferStatus.DECLINED);
    expect(nextStatus("counter")).toBe(OfferStatus.COUNTERED);
    expect(nextStatus("withdraw")).toBe(OfferStatus.WITHDRAWN);
  });
});

describe("isValidOfferAmount", () => {
  it("accepts a positive whole-penny amount at or below list price", () => {
    expect(isValidOfferAmount(10, 20)).toBe(true);
    expect(isValidOfferAmount(20, 20)).toBe(true);
    expect(isValidOfferAmount(19.99, 20)).toBe(true);
  });

  it("rejects zero, negative, and non-finite amounts", () => {
    expect(isValidOfferAmount(0, 20)).toBe(false);
    expect(isValidOfferAmount(-5, 20)).toBe(false);
    expect(isValidOfferAmount(Number.NaN, 20)).toBe(false);
    expect(isValidOfferAmount(Number.POSITIVE_INFINITY, 20)).toBe(false);
  });

  it("rejects sub-penny precision", () => {
    expect(isValidOfferAmount(10.001, 20)).toBe(false);
    expect(isValidOfferAmount(9.999, 20)).toBe(false);
  });

  it("rejects an amount above the asking price (you negotiate down)", () => {
    expect(isValidOfferAmount(20.01, 20)).toBe(false);
    expect(isValidOfferAmount(100, 20)).toBe(false);
  });
});

describe("isExpired / offerExpiry", () => {
  it("never expires when expiresAt is null", () => {
    expect(isExpired(null, new Date())).toBe(false);
  });

  it("is expired once now reaches or passes expiresAt", () => {
    const expiresAt = new Date("2026-01-01T00:00:00Z");
    expect(isExpired(expiresAt, new Date("2025-12-31T23:59:59Z"))).toBe(false);
    expect(isExpired(expiresAt, new Date("2026-01-01T00:00:00Z"))).toBe(true);
    expect(isExpired(expiresAt, new Date("2026-01-02T00:00:00Z"))).toBe(true);
  });

  it("offerExpiry adds the TTL window to creation time", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const expiry = offerExpiry(createdAt);
    const expected = createdAt.getTime() + OFFER_TTL_HOURS * 3600 * 1000;
    expect(expiry.getTime()).toBe(expected);
    // Original is not mutated.
    expect(createdAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
