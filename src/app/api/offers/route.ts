import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { OfferStatus } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { createOfferSchema } from "@/lib/validation";
import { isValidOfferAmount, offerExpiry } from "@/lib/offer";

// Offers / price negotiation (SOW §02 "makes offers", §05 listing detail).
// A buyer proposes an Offer on someone else's ACTIVE listing; the amount must be
// positive, whole-penny, and at or below the asking price. The negotiation state
// machine lives in /src/lib/offer.ts; action handling is in [id]/route.ts.

// GET /api/offers — offers involving the signed-in user, as buyer OR seller.
// `box=sent` (default) returns offers the user proposed; `box=received` returns
// offers on the user's own listings.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const box = new URL(req.url).searchParams.get("box") === "received" ? "received" : "sent";

  const where =
    box === "received"
      ? { listing: { sellerId: userId } }
      : { buyerId: userId };

  const offers = await prisma.offer.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      listing: {
        select: { id: true, title: true, price: true, currency: true, images: true, sellerId: true, status: true },
      },
    },
  });

  return NextResponse.json({
    box,
    offers: offers.map((o) => ({
      id: o.id,
      amount: o.amount.toString(),
      currency: o.currency,
      status: o.status,
      message: o.message,
      parentOfferId: o.parentOfferId,
      expiresAt: o.expiresAt,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      listing: {
        id: o.listing.id,
        title: o.listing.title,
        price: o.listing.price.toString(),
        currency: o.listing.currency,
        image: o.listing.images[0] ?? null,
        sellerId: o.listing.sellerId,
        status: o.listing.status,
      },
    })),
  });
}

// POST /api/offers — buyer opens a new offer on a listing.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const buyerId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = createOfferSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsedBody.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const listingId = (body as { listingId?: unknown }).listingId;
  if (typeof listingId !== "string" || listingId.length < 1) {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  }
  const { amount, message } = parsedBody.data;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, price: true, currency: true, sellerId: true, status: true },
  });
  if (!listing || listing.status !== "ACTIVE") {
    return NextResponse.json({ error: "Listing is not available" }, { status: 404 });
  }
  if (listing.sellerId === buyerId) {
    return NextResponse.json({ error: "You cannot make an offer on your own listing" }, { status: 400 });
  }
  if (!isValidOfferAmount(amount, Number(listing.price))) {
    return NextResponse.json(
      { error: "Offer must be a positive amount at or below the asking price" },
      { status: 400 },
    );
  }

  // Block a second open offer from the same buyer on the same listing.
  const openStatuses: OfferStatus[] = [OfferStatus.PENDING, OfferStatus.COUNTERED];
  const existingOpen = await prisma.offer.findFirst({
    where: { listingId, buyerId, status: { in: openStatuses } },
    select: { id: true },
  });
  if (existingOpen) {
    return NextResponse.json(
      { error: "You already have an open offer on this listing" },
      { status: 409 },
    );
  }

  const now = new Date();
  const offer = await prisma.offer.create({
    data: {
      listingId,
      buyerId,
      amount: amount.toFixed(2),
      currency: listing.currency,
      status: OfferStatus.PENDING,
      message: message ? message : null,
      expiresAt: offerExpiry(now),
    },
  });

  await recordAudit({
    action: "offer_created",
    userId: buyerId,
    metadata: { offerId: offer.id, listingId, amount: offer.amount.toString() },
  });

  return NextResponse.json({ ok: true, offerId: offer.id }, { status: 201 });
}
