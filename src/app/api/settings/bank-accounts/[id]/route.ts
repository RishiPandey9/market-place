import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/settings/bank-accounts/[id] — set this account as the default payout
// destination. Owner-scoped; demotes any other default in one transaction.
export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const existing = await prisma.bankAccount.findUnique({
    where: { id },
    select: { id: true, userId: true, archivedAt: true },
  });
  if (!existing || existing.archivedAt) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
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
  const setDefault = (body as { isDefault?: unknown })?.isDefault === true;
  if (!setDefault) {
    return NextResponse.json(
      { error: "Only setting a default is supported." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.bankAccount.updateMany({
      where: { userId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    }),
    prisma.bankAccount.update({ where: { id }, data: { isDefault: true } }),
  ]);

  return NextResponse.json({ ok: true });
}

// DELETE /api/settings/bank-accounts/[id] — archive (soft-delete) a payout
// account. Soft delete preserves the reference for any past Withdrawal rows. If
// the removed account was the default, promote the newest remaining one.
export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const existing = await prisma.bankAccount.findUnique({
    where: { id },
    select: { id: true, userId: true, isDefault: true, archivedAt: true },
  });
  if (!existing || existing.archivedAt) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
  }
  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.bankAccount.update({
      where: { id },
      data: { archivedAt: new Date(), isDefault: false },
    });
    if (existing.isDefault) {
      const next = await tx.bankAccount.findFirst({
        where: { userId, archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (next) {
        await tx.bankAccount.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
  });

  await recordAudit({
    action: "bank_account_removed",
    userId,
    metadata: { bankAccountId: id },
  });

  return NextResponse.json({ ok: true });
}
