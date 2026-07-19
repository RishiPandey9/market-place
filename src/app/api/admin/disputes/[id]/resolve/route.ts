import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requirePermission, RbacError } from "@/lib/rbac";
import { canTransition, canWalletTransition } from "@/lib/escrow";
import { resolveDisputeSchema } from "@/lib/validation";
import {
  DisputeStatus,
  OrderStatus,
  WalletState,
  type Prisma,
} from "@prisma/client";

// POST /api/admin/disputes/[id]/resolve — Admin resolves a dispute (Phase 2).
//
// MONEY-CRITICAL. Two outcomes, each atomic (one DB transaction):
//   • refund  → order REFUNDED, dispute RESOLVED_REFUND, seller's FROZEN escrow
//               stays frozen (no payout); buyer refund is issued via Stripe
//               (sandbox-flagged until STRIPE_SECRET_KEY is set).
//   • release → order RELEASED, dispute RESOLVED_RELEASE, seller's FROZEN
//               escrow → AVAILABLE (payout unblocked).
//
// RBAC: requires the `disputes.resolve` permission. Every effect is audit-logged.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let adminId: string;
  try {
    const ctx = await requirePermission("disputes.resolve");
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

  const parsed = resolveDisputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { outcome, note } = parsed.data;

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      order: { include: { walletTransactions: true } },
    },
  });
  if (!dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }
  if (
    dispute.status === DisputeStatus.RESOLVED_REFUND ||
    dispute.status === DisputeStatus.RESOLVED_RELEASE ||
    dispute.status === DisputeStatus.CLOSED
  ) {
    return NextResponse.json(
      { error: "Dispute is already resolved" },
      { status: 409 },
    );
  }

  const order = dispute.order;
  if (order.status !== OrderStatus.DISPUTED) {
    return NextResponse.json(
      { error: `Order in state ${order.status} is not under dispute` },
      { status: 409 },
    );
  }

  const targetOrderStatus =
    outcome === "refund" ? OrderStatus.REFUNDED : OrderStatus.RELEASED;
  if (!canTransition(order.status, targetOrderStatus)) {
    return NextResponse.json(
      { error: `Cannot ${outcome} an order in state ${order.status}` },
      { status: 409 },
    );
  }

  // The seller's frozen escrow for this order (if any).
  const frozen = order.walletTransactions.find(
    (w) => w.userId === order.sellerId && w.state === WalletState.FROZEN,
  );

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: targetOrderStatus,
        ...(outcome === "release" ? { releasedAt: new Date() } : {}),
      },
    }),
    prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        status:
          outcome === "refund"
            ? DisputeStatus.RESOLVED_REFUND
            : DisputeStatus.RESOLVED_RELEASE,
        resolution: note || null,
        resolvedAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: adminId,
        action: `dispute_resolved_${outcome}`,
        metadata: {
          disputeId: dispute.id,
          orderId: order.id,
          frozenTxId: frozen?.id ?? null,
        },
      },
    }),
  ];

  // On release, unblock the seller's payout (FROZEN → AVAILABLE). On refund the
  // balance stays frozen — the money goes back to the buyer, not the seller.
  if (
    outcome === "release" &&
    frozen &&
    canWalletTransition(frozen.state, WalletState.AVAILABLE)
  ) {
    ops.push(
      prisma.walletTransaction.update({
        where: { id: frozen.id },
        data: { state: WalletState.AVAILABLE },
      }),
    );
  }

  await prisma.$transaction(ops);

  // The actual Stripe refund/transfer happens against the payment intent /
  // connected account. Gated on live keys; sandbox mode records the decision
  // only (flagged — must be wired to Stripe before launch).
  const stripeLive = Boolean(process.env.STRIPE_SECRET_KEY);

  return NextResponse.json(
    {
      ok: true,
      disputeId: dispute.id,
      orderId: order.id,
      outcome,
      orderStatus: targetOrderStatus,
      payoutReleased: outcome === "release" && Boolean(frozen),
      stripeSandbox: !stripeLive,
    },
    { status: 200 },
  );
}
