import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requirePermission, RbacError } from "@/lib/rbac";
import { moderateListingSchema } from "@/lib/validation";
import { ListingStatus } from "@prisma/client";

// PATCH /api/admin/listings/[id] — Admin moderates a listing (Phase 2).
//   approve → ACTIVE (from PENDING_REVIEW), reject → REJECTED, hide → HIDDEN.
// RBAC: requires `listings.moderate`. Audit-logged.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let adminId: string;
  try {
    const ctx = await requirePermission("listings.moderate");
    adminId = ctx.userId;
  } catch (e) {
    if (e instanceof RbacError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = moderateListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { action, note } = parsed.data;

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const nextStatus =
    action === "approve"
      ? ListingStatus.ACTIVE
      : action === "reject"
        ? ListingStatus.REJECTED
        : ListingStatus.HIDDEN;

  await prisma.$transaction([
    prisma.listing.update({
      where: { id: listing.id },
      data: { status: nextStatus },
    }),
    prisma.auditLog.create({
      data: {
        userId: adminId,
        action: `listing_${action}`,
        metadata: { listingId: listing.id, from: listing.status, to: nextStatus, note: note || null },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, listingId: listing.id, status: nextStatus });
}
