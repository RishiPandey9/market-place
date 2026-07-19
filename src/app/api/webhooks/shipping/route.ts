import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { prisma } from "@/lib/db";
import { canTransition } from "@/lib/escrow";
import { autoConfirmDeadline } from "@/lib/escrow";
import { OrderStatus } from "@prisma/client";

// POST /api/webhooks/shipping — Carrier tracking event handler (1.9).
//
// Hard constraints (CLAUDE.md #4): verifies the signature and is idempotent.
// Idempotency uses AuditLog (action="shipping_webhook") keyed on the carrier's
// event id, mirroring the Stripe webhook pattern.
//
// SANDBOX FLAG: signature verification uses an HMAC-SHA256 of the raw body with
// SHIPPING_WEBHOOK_SECRET. Real carriers vary (some send HMAC, some a token);
// swap this for the chosen aggregator's scheme before launch. If the secret is
// unset we reject — never accept unverified webhooks.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_ACTION = "shipping_webhook";

type ShippingEvent = {
  id: string;
  type: string; // e.g. "tracking.delivered", "tracking.in_transit"
  trackingNumber: string;
};

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: { action: WEBHOOK_ACTION, metadata: { path: ["eventId"], equals: eventId } },
    select: { id: true },
  });
  return existing !== null;
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // Constant-time compare; guard against length mismatch throwing.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.SHIPPING_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[shipping webhook] SHIPPING_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-shipping-signature");
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: ShippingEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!event.id || !event.type || !event.trackingNumber) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "tracking.delivered") {
      await handleDelivered(event.trackingNumber);
    }
    // Other tracking states (in_transit, out_for_delivery) are recorded for
    // idempotency but don't change order state in this cut.

    await prisma.auditLog.create({
      data: { action: WEBHOOK_ACTION, metadata: { eventId: event.id, type: event.type } },
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[shipping webhook] handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

// tracking.delivered → order SHIPPED → DELIVERED, and set the auto-confirm
// deadline so escrow auto-releases if the buyer neither confirms nor disputes.
async function handleDelivered(trackingNumber: string): Promise<void> {
  const order = await prisma.order.findFirst({ where: { trackingNumber } });
  if (!order) {
    console.warn(`[shipping webhook] no order for tracking ${trackingNumber}`);
    return;
  }
  if (!canTransition(order.status, OrderStatus.DELIVERED)) {
    return;
  }
  const deliveredAt = new Date();
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.DELIVERED,
      deliveredAt,
      autoConfirmAt: autoConfirmDeadline(deliveredAt),
    },
  });
}
