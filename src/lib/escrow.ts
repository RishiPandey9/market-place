import { OrderStatus, WalletState, VerificationLevel, WithdrawalStatus } from "@prisma/client";

// ==============================================================
// Escrow & pricing core (Phase 1.7 / 1.8) — money-critical.
// ==============================================================
// Pure functions only (no DB, no network) so they are unit-testable per
// CLAUDE.md hard-constraint #7. The route handlers and webhook compose these.

// --------------------------------------------------------------
// Buyer-protection fee
// --------------------------------------------------------------
// The SOW/plan (1.7) require "item + shipping + buyer-protection fee" but do not
// pin an exact formula. We use a Vinted-style fee: a percentage of the item
// price plus a fixed component. These are the single source of truth and are
// intentionally configurable — adjust here (or later via config/env) rather than
// sprinkling magic numbers across routes.
export const PROTECTION_FEE_PERCENT = 0.05; // 5% of item price
export const PROTECTION_FEE_FIXED = 0.7; // + £0.70 fixed

// Round to 2 decimal places using integer cents to avoid float drift.
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateProtectionFee(itemPrice: number): number {
  return round2(itemPrice * PROTECTION_FEE_PERCENT + PROTECTION_FEE_FIXED);
}

export type OrderPricing = {
  itemPrice: number;
  shippingPrice: number;
  protectionFee: number;
  totalPrice: number;
};

// Total the buyer pays = item + shipping + protection fee.
export function calculateOrderPricing(
  itemPrice: number,
  shippingPrice: number,
): OrderPricing {
  const item = round2(itemPrice);
  const shipping = round2(shippingPrice);
  const protectionFee = calculateProtectionFee(item);
  const totalPrice = round2(item + shipping + protectionFee);
  return { itemPrice: item, shippingPrice: shipping, protectionFee, totalPrice };
}

// Smallest currency unit (pence/cents) for Stripe PaymentIntent amounts.
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

// --------------------------------------------------------------
// Order state machine
// --------------------------------------------------------------
// Allowed forward transitions. Anything not listed is rejected — prevents an
// order from skipping escrow stages or moving backwards.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED, OrderStatus.DISPUTED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.DISPUTED],
  [OrderStatus.DELIVERED]: [OrderStatus.RELEASED, OrderStatus.DISPUTED],
  [OrderStatus.RELEASED]: [],
  [OrderStatus.DISPUTED]: [OrderStatus.REFUNDED, OrderStatus.RELEASED],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal order transition: ${from} → ${to}`);
  }
}

// --------------------------------------------------------------
// Wallet state machine (seller escrow balance)
// --------------------------------------------------------------
// PENDING  → funds captured, held in escrow (order paid, not yet released)
// AVAILABLE→ buyer confirmed / auto-confirmed → seller can withdraw
// FROZEN   → dispute opened, payout blocked pending resolution
// WITHDRAWN→ paid out to the seller's bank
const WALLET_TRANSITIONS: Record<WalletState, WalletState[]> = {
  [WalletState.PENDING]: [WalletState.AVAILABLE, WalletState.FROZEN],
  [WalletState.AVAILABLE]: [WalletState.WITHDRAWN, WalletState.FROZEN],
  [WalletState.FROZEN]: [WalletState.AVAILABLE, WalletState.PENDING],
  [WalletState.WITHDRAWN]: [],
};

export function canWalletTransition(from: WalletState, to: WalletState): boolean {
  return WALLET_TRANSITIONS[from]?.includes(to) ?? false;
}

// Auto-confirm window: how long after delivery before escrow auto-releases to
// the seller if the buyer neither confirms nor disputes. Configurable (1.8).
export const AUTO_CONFIRM_DAYS = 3;

export function autoConfirmDeadline(deliveredAt: Date): Date {
  const d = new Date(deliveredAt);
  d.setDate(d.getDate() + AUTO_CONFIRM_DAYS);
  return d;
}

// Ship window: how long after payment the seller has to dispatch before the
// order is eligible for auto-cancel (1.9). Configurable.
export const SHIP_WINDOW_DAYS = 5;

export function shipDeadline(paidAt: Date): Date {
  const d = new Date(paidAt);
  d.setDate(d.getDate() + SHIP_WINDOW_DAYS);
  return d;
}

// --------------------------------------------------------------
// Withdrawal eligibility (Phase 2 — KYC gate + escrow release)
// --------------------------------------------------------------
// A seller may withdraw only funds that have cleared escrow (WalletTransaction
// state == AVAILABLE) AND only once they have completed Level 3 identity
// verification (CLAUDE.md hard-constraint #8). This is a pure decision function
// so it is unit-testable per hard-constraint #7; the route composes it over the
// seller's wallet rows.

// Minimum verification level required before any real withdrawal is permitted.
export const WITHDRAWAL_REQUIRED_LEVEL: VerificationLevel =
  VerificationLevel.LEVEL_3_ID_VERIFIED;

export type WithdrawalDenyReason =
  | "kyc_required"
  | "invalid_amount"
  | "insufficient_available";

export type WithdrawalCheck =
  | { ok: true; availableBalance: number }
  | { ok: false; reason: WithdrawalDenyReason; availableBalance: number };

// Sum of a seller's escrow rows that have cleared to AVAILABLE. FROZEN (disputed)
// and PENDING (unreleased) balances are intentionally excluded.
export function availableBalance(
  wallet: { amount: number; state: WalletState }[],
): number {
  const total = wallet
    .filter((w) => w.state === WalletState.AVAILABLE)
    .reduce((sum, w) => sum + w.amount, 0);
  return round2(total);
}

export function checkWithdrawalEligibility(params: {
  verificationLevel: VerificationLevel;
  wallet: { amount: number; state: WalletState }[];
  requestedAmount: number;
}): WithdrawalCheck {
  const available = availableBalance(params.wallet);

  // KYC gate first: never reveal balances as withdrawable to an unverified user.
  if (params.verificationLevel !== WITHDRAWAL_REQUIRED_LEVEL) {
    return { ok: false, reason: "kyc_required", availableBalance: available };
  }
  if (!(params.requestedAmount > 0) || round2(params.requestedAmount) !== params.requestedAmount) {
    return { ok: false, reason: "invalid_amount", availableBalance: available };
  }
  if (params.requestedAmount > available) {
    return { ok: false, reason: "insufficient_available", availableBalance: available };
  }
  return { ok: true, availableBalance: available };
}

// Initial status for a newly recorded Withdrawal row. In sandbox (no real
// payment provider wired) the escrow release is immediate, so the row is PAID.
// In production the row starts REQUESTED and is advanced by the Stripe payout
// webhook (REQUESTED → PROCESSING → PAID / FAILED). Pure so it is unit-testable
// per CLAUDE.md #7.
export function initialWithdrawalStatus(sandbox: boolean): WithdrawalStatus {
  return sandbox ? WithdrawalStatus.PAID : WithdrawalStatus.REQUESTED;
}
