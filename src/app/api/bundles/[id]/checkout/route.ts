import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { OrderStatus } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { toMinorUnits } from "@/lib/escrow";
import { calculateBundlePricing } from "@/lib/bundle";
import { bundleCheckoutSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

// POST /api/bundles/[id]/checkout — buy every item in a bundle at once.
//
// The schema links a Bundle to its items but NOT to Orders (Order.listingId is
// single-listing; a bundleId column would need a migration). So a bundle
// purchase is modelled as one escrow Order PER item, all created atomically in a
// single transaction, with the shipping fee charged ONCE across the set (on the
// first order line). Each Order clears escrow independently, so dispute / refund
// / release keep working per item exactly as for a solo purchase.
//
// SANDBOX FLAG: like /api/orders, when STRIPE_SECRET_KEY is unset we create the
// Orders and a clearly-marked stub PaymentIntent per order so the flow is
// testable locally. This MUST be swapped for the real Stripe path before launch;
// it is gated purely on the env var. Never leave sandbox on in prod.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const buyerId = session.user.id;
  const { id: bundleId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bundleCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { address, shippingPrice } = parsed.data;

  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId },
    include: {
      items: {
        include: {
          listing: {
            select: {
              id: true,
              price: true,
              currency: true,
              country: true,
              status: true,
              sellerId: true,
            },
          },
        },
      },
    },
  });

  if (!bundle || bundle.buyerId !== buyerId) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }
  if (bundle.status !== "draft") {
    return NextResponse.json(
      { error: "This bundle has already been checked out or cancelled" },
      { status: 409 },
    );
  }
  if (bundle.items.length < 2) {
    return NextResponse.json(
      { error: "A bundle needs at least 2 items" },
      { status: 400 },
    );
  }

  const listings = bundle.items.map((it) => it.listing);

  // Re-validate at purchase time: every item still ACTIVE, one seller (not the
  // buyer), one currency, one country — and the ship-to country must match.
  if (listings.some((l) => l.status !== "ACTIVE")) {
    return NextResponse.json(
      { error: "One or more items are no longer available" },
      { status: 409 },
    );
  }
  const sellerId = listings[0].sellerId;
  if (!listings.every((l) => l.sellerId === sellerId)) {
    return NextResponse.json(
      { error: "All items in a bundle must be from the same seller" },
      { status: 400 },
    );
  }
  if (sellerId === buyerId) {
    return NextResponse.json(
      { error: "You cannot buy your own listings" },
      { status: 400 },
    );
  }
  const currency = listings[0].currency;
  if (!listings.every((l) => l.currency === currency)) {
    return NextResponse.json(
      { error: "Bundle items must share one currency" },
      { status: 400 },
    );
  }
  const country = listings[0].country;
  if (!listings.every((l) => l.country === country)) {
    return NextResponse.json(
      { error: "Bundle items must share one country" },
      { status: 400 },
    );
  }
  if (address.country !== country) {
    return NextResponse.json(
      { error: "Ship-to country must match the items' country" },
      { status: 400 },
    );
  }

  // Item prices come from the listings (server-authoritative); shipping is the
  // single client-supplied combined rate. Pricing splits shipping onto the first
  // line so each Order's columns still sum to its own total.
  const pricing = calculateBundlePricing(
    listings.map((l) => ({ listingId: l.id, itemPrice: Number(l.price) })),
    shippingPrice,
  );

  const savedAddress = await prisma.address.create({
    data: {
      userId: buyerId,
      line1: address.line1,
      line2: address.line2 || null,
      city: address.city,
      postalCode: address.postalCode,
      country: address.country,
    },
  });

  // Create every Order + mark the bundle offered atomically. If any insert
  // fails the whole bundle checkout rolls back — no partial purchases.
  const orderIds = await prisma.$transaction(async (tx) => {
    const created: string[] = [];
    for (const line of pricing.lines) {
      const order = await tx.order.create({
        data: {
          buyerId,
          sellerId,
          listingId: line.listingId,
          status: OrderStatus.PENDING_PAYMENT,
          itemPrice: line.itemPrice.toFixed(2),
          shippingPrice: line.shippingPrice.toFixed(2),
          protectionFee: line.protectionFee.toFixed(2),
          totalPrice: line.totalPrice.toFixed(2),
          currency,
        },
        select: { id: true },
      });
      created.push(order.id);
    }
    await tx.bundle.update({
      where: { id: bundle.id },
      data: { status: "offered" },
    });
    return created;
  });

  // --- PaymentIntent per order (real Stripe if configured, sandbox otherwise) ---
  let sandbox = false;
  const payments: { orderId: string; clientSecret: string }[] = [];
  for (let i = 0; i < orderIds.length; i++) {
    const orderId = orderIds[i];
    const line = pricing.lines[i];
    let paymentIntentId: string;
    let clientSecret: string;

    if (process.env.STRIPE_SECRET_KEY) {
      const intent = await stripe.paymentIntents.create({
        amount: toMinorUnits(line.totalPrice),
        currency: currency.toLowerCase(),
        metadata: {
          orderId,
          bundleId: bundle.id,
          buyerId,
          sellerId,
          listingId: line.listingId,
        },
      });
      paymentIntentId = intent.id;
      clientSecret = intent.client_secret ?? "";
    } else {
      sandbox = true;
      paymentIntentId = `pi_sandbox_${orderId}`;
      clientSecret = `${paymentIntentId}_secret_sandbox`;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { stripePaymentIntentId: paymentIntentId },
    });
    payments.push({ orderId, clientSecret });
  }

  if (sandbox) {
    console.warn(
      `[bundle-checkout] SANDBOX PaymentIntents for bundle ${bundle.id} — ` +
        "STRIPE_SECRET_KEY not set. No real charges created. Configure Stripe before launch.",
    );
  }

  await recordAudit({
    action: "bundle_checkout",
    userId: buyerId,
    metadata: {
      bundleId: bundle.id,
      sellerId,
      orderIds,
      grandTotal: pricing.grandTotal.toFixed(2),
      currency,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      bundleId: bundle.id,
      orderIds,
      pricing,
      currency,
      addressId: savedAddress.id,
      payments,
      sandbox,
    },
    { status: 201 },
  );
}
