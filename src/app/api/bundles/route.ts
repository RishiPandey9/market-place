import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { createBundleSchema } from "@/lib/validation";
import { sameSeller, hasDuplicates } from "@/lib/bundle";

// Bundles (SOW §09 "smart bundles"). A buyer groups 2–20 ACTIVE listings from
// the SAME seller to buy together and pay shipping once. The pricing/grouping
// rules live in /src/lib/bundle.ts; checkout is in [id]/checkout/route.ts.

// GET /api/bundles — the signed-in buyer's own bundles (draft + history).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const buyerId = session.user.id;

  const bundles = await prisma.bundle.findMany({
    where: { buyerId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      items: {
        include: {
          listing: {
            select: { id: true, title: true, price: true, currency: true, images: true, status: true, sellerId: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    bundles: bundles.map((b) => ({
      id: b.id,
      status: b.status,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      items: b.items.map((it) => ({
        listingId: it.listing.id,
        title: it.listing.title,
        price: it.listing.price.toString(),
        currency: it.listing.currency,
        image: it.listing.images[0] ?? null,
        status: it.listing.status,
      })),
    })),
  });
}

// POST /api/bundles — create a draft bundle from a set of listing ids. All must
// be ACTIVE, belong to ONE seller (not the buyer), and be distinct.
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

  const parsed = createBundleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { listingIds } = parsed.data;

  if (hasDuplicates(listingIds)) {
    return NextResponse.json(
      { error: "A bundle cannot contain the same item twice" },
      { status: 400 },
    );
  }

  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds } },
    select: { id: true, sellerId: true, status: true },
  });

  // Every requested listing must exist and be ACTIVE.
  if (listings.length !== listingIds.length) {
    return NextResponse.json(
      { error: "One or more items are no longer available" },
      { status: 404 },
    );
  }
  if (listings.some((l) => l.status !== "ACTIVE")) {
    return NextResponse.json(
      { error: "One or more items are not available for purchase" },
      { status: 400 },
    );
  }

  // Single-seller rule, and the buyer can't bundle their own items.
  if (!sameSeller(listings.map((l) => l.sellerId))) {
    return NextResponse.json(
      { error: "All items in a bundle must be from the same seller" },
      { status: 400 },
    );
  }
  if (listings[0].sellerId === buyerId) {
    return NextResponse.json(
      { error: "You cannot bundle your own listings" },
      { status: 400 },
    );
  }

  const bundle = await prisma.bundle.create({
    data: {
      buyerId,
      status: "draft",
      items: { create: listingIds.map((listingId) => ({ listingId })) },
    },
    select: { id: true },
  });

  await recordAudit({
    action: "bundle_created",
    userId: buyerId,
    metadata: { bundleId: bundle.id, listingIds, sellerId: listings[0].sellerId },
  });

  return NextResponse.json({ ok: true, bundleId: bundle.id }, { status: 201 });
}
