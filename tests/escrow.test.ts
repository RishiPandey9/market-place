import { describe, it, expect } from "vitest";
import { OrderStatus, WalletState, VerificationLevel } from "@prisma/client";

import {
  calculateProtectionFee,
  calculateOrderPricing,
  round2,
  toMinorUnits,
  canTransition,
  assertTransition,
  canWalletTransition,
  autoConfirmDeadline,
  shipDeadline,
  availableBalance,
  checkWithdrawalEligibility,
  WITHDRAWAL_REQUIRED_LEVEL,
  PROTECTION_FEE_PERCENT,
  PROTECTION_FEE_FIXED,
  AUTO_CONFIRM_DAYS,
  SHIP_WINDOW_DAYS,
} from "@/lib/escrow";

describe("escrow pricing (money-critical)", () => {
  it("protection fee = percent * item + fixed, rounded to 2dp", () => {
    // 45.00 * 0.05 + 0.70 = 2.25 + 0.70 = 2.95
    expect(calculateProtectionFee(45)).toBe(2.95);
    expect(PROTECTION_FEE_PERCENT).toBe(0.05);
    expect(PROTECTION_FEE_FIXED).toBe(0.7);
  });

  it("rounds fee half-up without float drift", () => {
    // 19.99 * 0.05 = 0.9995 -> +0.70 = 1.6995 -> 1.70
    expect(calculateProtectionFee(19.99)).toBe(1.7);
  });

  it("order total = item + shipping + protection fee", () => {
    const p = calculateOrderPricing(45, 3.99);
    expect(p.itemPrice).toBe(45);
    expect(p.shippingPrice).toBe(3.99);
    expect(p.protectionFee).toBe(2.95);
    expect(p.totalPrice).toBe(51.94);
  });

  it("handles zero shipping", () => {
    const p = calculateOrderPricing(10, 0);
    // 10*0.05+0.70 = 1.20 ; total = 11.20
    expect(p.protectionFee).toBe(1.2);
    expect(p.totalPrice).toBe(11.2);
  });

  it("round2 avoids binary float error", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("toMinorUnits converts pounds to integer pence", () => {
    expect(toMinorUnits(51.94)).toBe(5194);
    expect(toMinorUnits(0.7)).toBe(70);
  });
});

describe("order state machine", () => {
  it("allows the happy escrow path", () => {
    expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID)).toBe(true);
    expect(canTransition(OrderStatus.PAID, OrderStatus.SHIPPED)).toBe(true);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.RELEASED)).toBe(true);
  });

  it("rejects skipping escrow stages", () => {
    expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.SHIPPED)).toBe(false);
    expect(canTransition(OrderStatus.PAID, OrderStatus.RELEASED)).toBe(false);
  });

  it("rejects moving backwards or out of terminal states", () => {
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.PAID)).toBe(false);
    expect(canTransition(OrderStatus.RELEASED, OrderStatus.SHIPPED)).toBe(false);
    expect(canTransition(OrderStatus.REFUNDED, OrderStatus.RELEASED)).toBe(false);
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toBe(false);
  });

  it("allows dispute from paid/shipped/delivered and resolution to refund/release", () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.DISPUTED)).toBe(true);
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.DISPUTED)).toBe(true);
    expect(canTransition(OrderStatus.DISPUTED, OrderStatus.REFUNDED)).toBe(true);
    expect(canTransition(OrderStatus.DISPUTED, OrderStatus.RELEASED)).toBe(true);
  });

  it("assertTransition throws on an illegal move", () => {
    expect(() => assertTransition(OrderStatus.PAID, OrderStatus.RELEASED)).toThrow();
    expect(() => assertTransition(OrderStatus.DELIVERED, OrderStatus.RELEASED)).not.toThrow();
  });
});

describe("wallet state machine", () => {
  it("PENDING escrow can be released to AVAILABLE or frozen", () => {
    expect(canWalletTransition(WalletState.PENDING, WalletState.AVAILABLE)).toBe(true);
    expect(canWalletTransition(WalletState.PENDING, WalletState.FROZEN)).toBe(true);
  });

  it("AVAILABLE funds can be withdrawn or frozen", () => {
    expect(canWalletTransition(WalletState.AVAILABLE, WalletState.WITHDRAWN)).toBe(true);
    expect(canWalletTransition(WalletState.AVAILABLE, WalletState.FROZEN)).toBe(true);
  });

  it("cannot withdraw straight from PENDING escrow", () => {
    expect(canWalletTransition(WalletState.PENDING, WalletState.WITHDRAWN)).toBe(false);
  });

  it("WITHDRAWN is terminal", () => {
    expect(canWalletTransition(WalletState.WITHDRAWN, WalletState.AVAILABLE)).toBe(false);
  });

  it("a frozen balance can be released or returned to pending after review", () => {
    expect(canWalletTransition(WalletState.FROZEN, WalletState.AVAILABLE)).toBe(true);
    expect(canWalletTransition(WalletState.FROZEN, WalletState.PENDING)).toBe(true);
  });
});

describe("timers", () => {
  it("auto-confirm deadline is delivery + AUTO_CONFIRM_DAYS", () => {
    const delivered = new Date("2026-01-01T00:00:00.000Z");
    const deadline = autoConfirmDeadline(delivered);
    const expected = new Date("2026-01-01T00:00:00.000Z");
    expected.setDate(expected.getDate() + AUTO_CONFIRM_DAYS);
    expect(deadline.toISOString()).toBe(expected.toISOString());
  });

  it("ship deadline is payment + SHIP_WINDOW_DAYS", () => {
    const paid = new Date("2026-01-01T00:00:00.000Z");
    const deadline = shipDeadline(paid);
    const expected = new Date("2026-01-01T00:00:00.000Z");
    expected.setDate(expected.getDate() + SHIP_WINDOW_DAYS);
    expect(deadline.toISOString()).toBe(expected.toISOString());
  });
});

describe("withdrawal eligibility (money-critical, KYC-gated)", () => {
  const L3 = VerificationLevel.LEVEL_3_ID_VERIFIED;
  const L1 = VerificationLevel.LEVEL_1_BASIC;

  it("Level 3 is the required verification level", () => {
    expect(WITHDRAWAL_REQUIRED_LEVEL).toBe(L3);
  });

  it("availableBalance sums only AVAILABLE rows", () => {
    const wallet = [
      { amount: 10, state: WalletState.AVAILABLE },
      { amount: 5.5, state: WalletState.AVAILABLE },
      { amount: 100, state: WalletState.PENDING },
      { amount: 40, state: WalletState.FROZEN },
      { amount: 7, state: WalletState.WITHDRAWN },
    ];
    expect(availableBalance(wallet)).toBe(15.5);
  });

  it("blocks withdrawal when the seller is NOT Level 3 verified (KYC gate)", () => {
    const wallet = [{ amount: 50, state: WalletState.AVAILABLE }];
    const res = checkWithdrawalEligibility({
      verificationLevel: L1,
      wallet,
      requestedAmount: 50,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("kyc_required");
    // Balance is still reported, but withdrawal is denied.
    expect(res.availableBalance).toBe(50);
  });

  it("KYC gate takes precedence even over an invalid amount", () => {
    const wallet = [{ amount: 50, state: WalletState.AVAILABLE }];
    const res = checkWithdrawalEligibility({
      verificationLevel: L1,
      wallet,
      requestedAmount: -5,
    });
    expect(res.ok === false && res.reason).toBe("kyc_required");
  });

  it("allows a valid full withdrawal for a verified seller", () => {
    const wallet = [
      { amount: 30, state: WalletState.AVAILABLE },
      { amount: 20, state: WalletState.AVAILABLE },
    ];
    const res = checkWithdrawalEligibility({
      verificationLevel: L3,
      wallet,
      requestedAmount: 50,
    });
    expect(res.ok).toBe(true);
    expect(res.availableBalance).toBe(50);
  });

  it("rejects amounts above the available balance", () => {
    const wallet = [{ amount: 50, state: WalletState.AVAILABLE }];
    const res = checkWithdrawalEligibility({
      verificationLevel: L3,
      wallet,
      requestedAmount: 50.01,
    });
    expect(res.ok === false && res.reason).toBe("insufficient_available");
  });

  it("rejects zero, negative, and sub-penny amounts", () => {
    const wallet = [{ amount: 50, state: WalletState.AVAILABLE }];
    for (const bad of [0, -1, 10.001]) {
      const res = checkWithdrawalEligibility({
        verificationLevel: L3,
        wallet,
        requestedAmount: bad,
      });
      expect(res.ok === false && res.reason).toBe("invalid_amount");
    }
  });

  it("does not count PENDING or FROZEN escrow as withdrawable", () => {
    const wallet = [
      { amount: 100, state: WalletState.PENDING },
      { amount: 40, state: WalletState.FROZEN },
    ];
    const res = checkWithdrawalEligibility({
      verificationLevel: L3,
      wallet,
      requestedAmount: 100,
    });
    expect(res.ok).toBe(false);
    expect(res.availableBalance).toBe(0);
    expect(res.ok === false && res.reason).toBe("insufficient_available");
  });
});
