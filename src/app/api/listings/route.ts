import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createListingSchema } from "@/lib/validation";
import { checkCanPublish } from "@/lib/trust";
import { ListingStatus } from "@prisma/client";

// Optional string fields arrive as "" from the form; store them as null.
function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// GET /api/listings  → the signed-in seller's own listings ("my closet").
// Public catalogue browsing has its own route (/api/search); this endpoint is
// owner-scoped and returns every status, including DRAFT and HIDDEN.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listings = await prisma.listing.findMany({
    where: { sellerId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { category: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ listings });
}

// POST /api/listings  → create a listing owned by the current user.
// Seller may publish straight to ACTIVE or keep it as a DRAFT (publish flow, 1.4).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Category must exist — Listing.categoryId is a required FK.
  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
    select: { id: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 400 });
  }

  // Verification-tier selling limit (SOW 1.2): only enforced when the seller is
  // publishing straight to ACTIVE. Saving a DRAFT never consumes tier capacity.
  if (data.status === "ACTIVE") {
    const [seller, activeCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { verificationLevel: true },
      }),
      prisma.listing.count({
        where: { sellerId: session.user.id, status: ListingStatus.ACTIVE },
      }),
    ]);
    if (!seller) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const check = checkCanPublish({
      level: seller.verificationLevel,
      currentActiveCount: activeCount,
      price: data.price,
    });
    if (!check.ok) {
      return NextResponse.json(
        {
          error:
            check.reason === "price_exceeds_tier"
              ? `Items over ${check.limit} require a higher verification level. Verify your identity to list higher-value items.`
              : `You've reached your active-listing limit (${check.limit}) for your verification level. Verify your identity to list more.`,
          reason: check.reason,
          limit: check.limit,
        },
        { status: 403 },
      );
    }
  }

  const listing = await prisma.listing.create({
    data: {
      sellerId: session.user.id,
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      brand: emptyToNull(data.brand),
      size: emptyToNull(data.size),
      condition: emptyToNull(data.condition),
      color: emptyToNull(data.color),
      price: data.price,
      currency: data.currency,
      parcelSize: data.parcelSize,
      images: data.images,
      country: data.country,
      status: data.status,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ listing }, { status: 201 });
}
