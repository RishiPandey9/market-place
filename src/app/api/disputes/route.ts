import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canTransition, canWalletTransition } from "@/lib/escrow";
import { createDisputeSchema } from "@/lib/validation";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/ratelimit";
import { recordAudit } from "@/lib/audit";
import { OrderStatus, WalletState, type Prisma } from "@prisma/client";

// POST /api/disputes — Raise a dispute (Phase 1.10).
//
// Effect: Order → DISPUTED and the seller's escrow WalletTransaction is FROZEN
// (payout blocked) pending manual review. Money-critical: the freeze + status
// change run in one DB transaction. Resolution (refund or release) is performed
// by an admin via the admin console (Phase 2), never here.
//
// Only the order's buyer or seller may raise a dispute, and only while the order
// is in an active, pre-completion state (PAID / SHIPPED / DELIVERED).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Abuse guard: cap dispute creation per user.
  const limit = rateLimit(`dispute:${session.user.id}`, RATE_LIMITS.dispute);
  if (!limit.ok) {
    await recordAudit({
      action: "dispute_rate_limited",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Too many disputes raised. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createDisputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { orderId, reason } = parsed.data;
  const userId = session.user.id;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { walletTransactions: true, dispute: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.buyerId !== userId && order.sellerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.dispute) {
    return NextResponse.json(
      { error: "A dispute already exists for this order" },
      { status: 409 },
    );
  }
  if (!canTransition(order.status, OrderStatus.DISPUTED)) {
    return NextResponse.json(
      { error: `Order in state ${order.status} cannot be disputed` },
      { status: 409 },
    );
  }

  // Freeze the seller's escrow balance for this order (PENDING or AVAILABLE →
  // FROZEN). If it's already withdrawn there's nothing to freeze — still allow
  // the dispute to be recorded for manual handling.
  const freezable = order.walletTransactions.find(
    (w) =>
      w.userId === order.sellerId &&
      (w.state === WalletState.PENDING || w.state === WalletState.AVAILABLE) &&
      canWalletTransition(w.state, WalletState.FROZEN),
  );

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.dispute.create({
      data: { orderId: order.id, raisedById: userId, reason },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.DISPUTED },
    }),
    prisma.auditLog.create({
      data: {
        userId,
        action: "dispute_raised",
        metadata: { orderId: order.id, frozenTxId: freezable?.id ?? null },
      },
    }),
  ];
  if (freezable) {
    ops.push(
      prisma.walletTransaction.update({
        where: { id: freezable.id },
        data: { state: WalletState.FROZEN },
      }),
    );
  }

  await prisma.$transaction(ops);

  return NextResponse.json(
    { ok: true, orderId: order.id, status: OrderStatus.DISPUTED, payoutFrozen: Boolean(freezable) },
    { status: 201 },
  );
}
