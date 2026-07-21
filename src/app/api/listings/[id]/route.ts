import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateListingSchema } from "@/lib/validation";
import { checkCanPublish } from "@/lib/trust";
import { ListingStatus } from "@prisma/client";

// Optional string fields arrive as "" from the form; store them as null.
function emptyToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/listings/[id]
// Public read for a live (ACTIVE) listing. The owner may also view its own
// listing in any status (DRAFT, HIDDEN, etc.) so edit/preview works.
export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      seller: { select: { id: true, email: true, verificationLevel: true } },
    },
  });

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.status !== "ACTIVE") {
    const session = await getServerSession(authOptions);
    const isOwner = session?.user?.id === listing.sellerId;
    if (!isOwner) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ listing });
}

// PATCH /api/listings/[id]  → edit, owner only (1.5).
export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, sellerId: true, status: true, price: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (existing.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 400 });
    }
  }

  // Verification-tier selling limit (SOW 1.2). Enforce whenever the edit results
  // in an ACTIVE listing: either a DRAFT/HIDDEN → ACTIVE publish, or a price
  // change on an already-ACTIVE item. The active-listing count excludes this
  // listing so re-publishing it doesn't count against itself.
  const willBeActive =
    data.status === "ACTIVE" ||
    (data.status === undefined && existing.status === ListingStatus.ACTIVE);
  const isPublishTransition =
    data.status === "ACTIVE" && existing.status !== ListingStatus.ACTIVE;
  const effectivePrice = data.price ?? Number(existing.price);

  if (willBeActive) {
    const [seller, activeCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { verificationLevel: true },
      }),
      prisma.listing.count({
        where: {
          sellerId: session.user.id,
          status: ListingStatus.ACTIVE,
          id: { not: id },
        },
      }),
    ]);
    if (!seller) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const check = checkCanPublish({
      level: seller.verificationLevel,
      // Only a publish transition consumes a new active slot; editing an item
      // that is already ACTIVE must not be blocked by the count.
      currentActiveCount: isPublishTransition ? activeCount : 0,
      price: effectivePrice,
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

  const listing = await prisma.listing.update({
    where: { id },
    data: {
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

  return NextResponse.json({ listing });
}

// DELETE /api/listings/[id]  → hide, owner only.
// Soft delete: listings are referenced by orders, so we never hard-delete.
// Sets status to HIDDEN, matching the route map's "Remove/hide listing".
export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, sellerId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (existing.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.listing.update({
    where: { id },
    data: { status: "HIDDEN" },
  });

  return NextResponse.json({ ok: true });
}
