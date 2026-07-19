import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateListingSchema } from "@/lib/validation";

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
    select: { id: true, sellerId: true },
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
