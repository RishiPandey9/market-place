import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertTransition, canWalletTransition } from "@/lib/escrow";
import { OrderStatus, WalletState } from "@prisma/client";

// POST /api/orders/[id]/confirm — Buyer confirms delivery (Phase 1.8).
//
// Effect: order DELIVERED → RELEASED, and the seller's escrow WalletTransaction
// PENDING → AVAILABLE (funds become withdrawable). Money-critical; the state
// transitions are validated via the escrow state machine, and both updates run
// in one DB transaction so they can't partially apply.
//
// Only the buyer may confirm. The auto-confirm timer (autoConfirmAt) performs
// the same release automatically after the window if the buyer does nothing.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { walletTransactions: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.buyerId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the buyer can confirm delivery" },
      { status: 403 },
    );
  }

  // Must be DELIVERED to be confirmed. assertTransition also rejects DISPUTED,
  // RELEASED, etc.
  try {
    assertTransition(order.status, OrderStatus.RELEASED);
  } catch {
    return NextResponse.json(
      { error: `Order in state ${order.status} cannot be confirmed` },
      { status: 409 },
    );
  }

  // The escrow transaction created at payment time (seller, PENDING).
  const escrow = order.walletTransactions.find(
    (w) => w.userId === order.sellerId && w.state === WalletState.PENDING,
  );
  if (!escrow || !canWalletTransition(escrow.state, WalletState.AVAILABLE)) {
    return NextResponse.json(
      { error: "No releasable escrow balance for this order" },
      { status: 409 },
    );
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.RELEASED, releasedAt: now },
    }),
    prisma.walletTransaction.update({
      where: { id: escrow.id },
      data: { state: WalletState.AVAILABLE },
    }),
    prisma.auditLog.create({
      data: {
        userId: order.buyerId,
        action: "order_confirmed",
        metadata: { orderId: order.id, releasedTxId: escrow.id },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, orderId: order.id, status: OrderStatus.RELEASED });
}
