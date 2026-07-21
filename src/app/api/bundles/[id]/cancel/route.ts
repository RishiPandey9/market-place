import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

// POST /api/bundles/[id]/cancel — the buyer discards a draft bundle. Only a
// bundle still in "draft" (not yet checked out) can be cancelled.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const buyerId = session.user.id;
  const { id: bundleId } = await params;

  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId },
    select: { id: true, buyerId: true, status: true },
  });
  if (!bundle || bundle.buyerId !== buyerId) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }
  if (bundle.status !== "draft") {
    return NextResponse.json(
      { error: "Only a draft bundle can be cancelled" },
      { status: 409 },
    );
  }

  await prisma.bundle.update({
    where: { id: bundle.id },
    data: { status: "cancelled" },
  });

  await recordAudit({
    action: "bundle_cancelled",
    userId: buyerId,
    metadata: { bundleId: bundle.id },
  });

  return NextResponse.json({ ok: true });
}
