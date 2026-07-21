import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { OfferStatus } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { offerActionSchema } from "@/lib/validation";
import {
  canAct,
  nextStatus,
  isExpired,
  isValidOfferAmount,
  offerExpiry,
  type OfferParty,
} from "@/lib/offer";

// POST /api/offers/[id] — act on an open offer: accept / decline / counter /
// withdraw. RBAC here is ownership-based (not admin): the actor must be the
// buyer or the seller of the offer's listing, and the negotiation state machine
// (src/lib/offer.ts) decides whether the action is legal for their turn.
//
// A `counter` terminates the current offer as COUNTERED and creates a linked
// child offer (parentOfferId) in the awaiting-the-other-party state, flipping
// whose turn it is. An `accept` freezes the agreed price; the buyer then checks
// out at that price (checkout reads the accepted offer, price stays server-side).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = offerActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { action, amount, message } = parsed.data;

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, sellerId: true, price: true, status: true } },
    },
  });
  if (!offer) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  // Determine the actor's role relative to THIS offer's listing.
  const isBuyer = offer.buyerId === userId;
  const isSeller = offer.listing.sellerId === userId;
  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: "Not your offer" }, { status: 403 });
  }
  const actor: OfferParty = isBuyer ? "buyer" : "seller";

  // Lazily expire a lapsed offer before acting on it.
  if (
    (offer.status === OfferStatus.PENDING || offer.status === OfferStatus.COUNTERED) &&
    isExpired(offer.expiresAt, new Date())
  ) {
    await prisma.offer.update({
      where: { id: offer.id },
      data: { status: OfferStatus.EXPIRED },
    });
    return NextResponse.json({ error: "This offer has expired" }, { status: 409 });
  }

  if (!canAct(offer.status, actor, action)) {
    return NextResponse.json(
      { error: `You cannot ${action} this offer right now` },
      { status: 409 },
    );
  }

  // Counter: close the current offer, open a linked child in the flipped state.
  if (action === "counter") {
    if (amount === undefined) {
      return NextResponse.json({ error: "A counter-offer needs an amount" }, { status: 400 });
    }
    if (!isValidOfferAmount(amount, Number(offer.listing.price))) {
      return NextResponse.json(
        { error: "Counter must be a positive amount at or below the asking price" },
        { status: 400 },
      );
    }
    const now = new Date();
    // The child offer's turn is the OTHER party. If the seller counters a
    // PENDING (buyer's) offer, the child is COUNTERED (buyer's turn). If the
    // buyer counters a COUNTERED (seller's) offer, the child is PENDING again.
    const childStatus =
      actor === "seller" ? OfferStatus.COUNTERED : OfferStatus.PENDING;

    const child = await prisma.$transaction(async (tx) => {
      await tx.offer.update({
        where: { id: offer.id },
        data: { status: OfferStatus.COUNTERED },
      });
      return tx.offer.create({
        data: {
          listingId: offer.listingId,
          buyerId: offer.buyerId,
          amount: amount.toFixed(2),
          currency: offer.currency,
          status: childStatus,
          message: message ? message : null,
          parentOfferId: offer.id,
          expiresAt: offerExpiry(now),
        },
      });
    });

    await recordAudit({
      action: "offer_countered",
      userId,
      metadata: { offerId: offer.id, childOfferId: child.id, amount: child.amount.toString() },
    });
    return NextResponse.json({ ok: true, offerId: child.id, status: child.status });
  }

  // accept / decline / withdraw — simple status transition.
  const status = nextStatus(action);
  await prisma.offer.update({ where: { id: offer.id }, data: { status } });

  await recordAudit({
    action:
      action === "accept"
        ? "offer_accepted"
        : action === "decline"
        ? "offer_declined"
        : "offer_withdrawn",
    userId,
    metadata: { offerId: offer.id, listingId: offer.listingId },
  });

  return NextResponse.json({ ok: true, status });
}
