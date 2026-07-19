import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { OrderStatus, WalletState } from "@prisma/client";

// POST /api/webhooks/stripe
//
// Hard constraints (CLAUDE.md #4): verifies the Stripe signature and is
// idempotent. Idempotency is enforced by recording each processed event id in
// AuditLog (action="stripe_webhook") and short-circuiting on replay — no schema
// change required.

export const runtime = "nodejs";
// Stripe needs the raw, unparsed body to verify the signature.
export const dynamic = "force-dynamic";

const WEBHOOK_ACTION = "stripe_webhook";

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: { action: WEBHOOK_ACTION, metadata: { path: ["eventId"], equals: eventId } },
    select: { id: true },
  });
  return existing !== null;
}

async function markProcessed(event: Stripe.Event): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: WEBHOOK_ACTION,
      metadata: { eventId: event.id, type: event.type },
    },
  });
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe webhook] signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency guard — acknowledge replays without re-applying side effects.
  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        // Unhandled event types are still recorded as processed below.
        break;
    }

    await markProcessed(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    // Do NOT mark processed on failure, so Stripe retries redeliver the event.
    console.error(`[stripe webhook] handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

/**
 * payment_intent.succeeded → mark the Order PAID and create the escrow
 * WalletTransaction in PENDING state (funds held, not released to seller).
 */
async function handlePaymentIntentSucceeded(
  intent: Stripe.PaymentIntent
): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: intent.id },
  });

  if (!order) {
    // Order may not exist yet or PI belongs to another flow; nothing to do.
    console.warn(
      `[stripe webhook] no order for payment_intent ${intent.id}`
    );
    return;
  }

  // Guard against out-of-order redelivery moving a later-stage order backwards.
  if (order.status !== OrderStatus.PENDING_PAYMENT) {
    return;
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID },
    }),
    prisma.walletTransaction.create({
      data: {
        userId: order.sellerId,
        orderId: order.id,
        amount: order.itemPrice,
        currency: order.currency,
        state: WalletState.PENDING,
      },
    }),
  ]);
}

/**
 * account.updated → when a seller finishes Connect onboarding (charges +
 * payouts enabled), promote them to LEVEL_2_SELLER.
 */
async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  const onboardingComplete =
    account.details_submitted &&
    account.charges_enabled &&
    account.payouts_enabled;

  if (!onboardingComplete) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: { stripeAccountId: account.id },
    select: { id: true, verificationLevel: true },
  });

  if (!user) {
    return;
  }

  // Only elevate LEVEL_1 sellers; never downgrade a LEVEL_3 ID-verified user.
  if (user.verificationLevel === "LEVEL_1_BASIC") {
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationLevel: "LEVEL_2_SELLER" },
    });
  }
}
