import { OfferStatus } from "@prisma/client";

// ==============================================================
// Offers / price negotiation core (SOW §05 "makes offers").
// ==============================================================
// Pure functions only (no DB, no network) so the negotiation rules are
// unit-testable per CLAUDE.md #7 (offers move money at checkout). The route
// handlers compose these against the DB.
//
// Flow: a buyer proposes an Offer on a listing (PENDING). The seller may
// accept, decline, or counter. A counter flips the awaiting party (COUNTERED)
// and creates a linked child offer. The proposer of the currently-open offer may
// withdraw it. ACCEPTED lets the buyer check out at the agreed price.

// Default lifetime of an offer before it EXPIRES if no one acts.
export const OFFER_TTL_HOURS = 48;

// Terminal statuses — no further action is possible.
const TERMINAL: OfferStatus[] = [
  OfferStatus.ACCEPTED,
  OfferStatus.DECLINED,
  OfferStatus.EXPIRED,
  OfferStatus.WITHDRAWN,
];

export function isTerminal(status: OfferStatus): boolean {
  return TERMINAL.includes(status);
}

// Which party is expected to act next on an open offer.
// PENDING (buyer proposed) -> seller's turn.
// COUNTERED (seller countered) -> buyer's turn.
export type OfferParty = "buyer" | "seller";

export function awaitingParty(status: OfferStatus): OfferParty | null {
  if (status === OfferStatus.PENDING) return "seller";
  if (status === OfferStatus.COUNTERED) return "buyer";
  return null;
}

export type OfferAction = "accept" | "decline" | "counter" | "withdraw";

// Can `actor` perform `action` on an offer in `status`?
// `actor` is the role of the person acting relative to THIS offer's listing.
export function canAct(
  status: OfferStatus,
  actor: OfferParty,
  action: OfferAction,
): boolean {
  if (isTerminal(status)) return false;
  const waiting = awaitingParty(status);
  if (!waiting) return false;

  switch (action) {
    case "accept":
    case "decline":
    case "counter":
      // Only the party whose turn it is may accept/decline/counter.
      return actor === waiting;
    case "withdraw":
      // The proposer of the open offer (the OTHER party) may retract it.
      return actor !== waiting;
    default:
      return false;
  }
}

// Resulting status after a valid action.
export function nextStatus(action: OfferAction): OfferStatus {
  switch (action) {
    case "accept":
      return OfferStatus.ACCEPTED;
    case "decline":
      return OfferStatus.DECLINED;
    case "counter":
      return OfferStatus.COUNTERED;
    case "withdraw":
      return OfferStatus.WITHDRAWN;
  }
}

// An offer amount must be positive, in whole pence, and not above the asking
// price (you negotiate DOWN from list price, not up).
export function isValidOfferAmount(
  amount: number,
  listingPrice: number,
): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (Math.round(amount * 100) !== amount * 100) return false; // sub-penny
  if (amount > listingPrice) return false;
  return true;
}

// Has an offer with this expiry lapsed as of `now`?
export function isExpired(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

// Compute an offer's expiry from its creation time.
export function offerExpiry(createdAt: Date): Date {
  const d = new Date(createdAt.getTime());
  d.setHours(d.getHours() + OFFER_TTL_HOURS);
  return d;
}
