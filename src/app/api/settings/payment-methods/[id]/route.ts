import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/settings/payment-methods/[id] — set as default. Owner-scoped.
export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const existing = await prisma.paymentMethod.findUnique({
    where: { id },
    select: { id: true, userId: true, archivedAt: true },
  });
  if (!existing || existing.archivedAt) {
    return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
  }
  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if ((body as { isDefault?: unknown })?.isDefault !== true) {
    return NextResponse.json(
      { error: "Only setting a default is supported." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.paymentMethod.updateMany({
      where: { userId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    }),
    prisma.paymentMethod.update({ where: { id }, data: { isDefault: true } }),
  ]);

  return NextResponse.json({ ok: true });
}

// DELETE /api/settings/payment-methods/[id] — archive (soft delete). Owner-scoped.
export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const existing = await prisma.paymentMethod.findUnique({
    where: { id },
    select: { id: true, userId: true, isDefault: true, archivedAt: true },
  });
  if (!existing || existing.archivedAt) {
    return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
  }
  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentMethod.update({
      where: { id },
      data: { archivedAt: new Date(), isDefault: false },
    });
    if (existing.isDefault) {
      const next = await tx.paymentMethod.findFirst({
        where: { userId, archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (next) {
        await tx.paymentMethod.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
  });

  await recordAudit({
    action: "payment_method_removed",
    userId,
    metadata: { paymentMethodId: id },
  });

  return NextResponse.json({ ok: true });
}
