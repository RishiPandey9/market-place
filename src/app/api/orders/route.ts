import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { calculateOrderPricing, toMinorUnits } from "@/lib/escrow";
import { createOrderSchema } from "@/lib/validation";
import { OrderStatus } from "@prisma/client";

// POST /api/orders — Checkout (Phase 1.7).
//
// Creates an Order in PENDING_PAYMENT and a Stripe PaymentIntent for
// item + shipping + buyer-protection fee. Funds are captured to the PLATFORM
// balance (escrow) and only transferred to the seller on release — this is the
// separate-charges-and-transfers escrow model, so the platform holds funds.
//
// SANDBOX FLAG: when STRIPE_SECRET_KEY is not configured (keys deferred per the
// project owner), we still create the Order and return a clearly-marked stub
// PaymentIntent so the flow is testable locally. This MUST be swapped for the
// real Stripe path before launch — it is gated purely on the env var, so
// setting the key flips it to live automatically. Never leave sandbox on in prod.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { listingId, address, shippingPrice } = parsed.data;
  const buyerId = session.user.id;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { seller: { select: { id: true, country: true, stripeAccountId: true } } },
  });

  if (!listing || listing.status !== "ACTIVE") {
    return NextResponse.json({ error: "Listing is not available" }, { status: 404 });
  }
  if (listing.sellerId === buyerId) {
    return NextResponse.json({ error: "You cannot buy your own listing" }, { status: 400 });
  }

  // Same-country transactions only (SOW hard rule).
  if (address.country !== listing.country) {
    return NextResponse.json(
      { error: "Cross-border orders are not supported; ship-to country must match the item's country" },
      { status: 400 },
    );
  }

  // Item price + currency come from the listing, never the client.
  const itemPrice = Number(listing.price);
  const pricing = calculateOrderPricing(itemPrice, shippingPrice);
  const currency = listing.currency;

  // Persist the buyer's shipping address (used later for label generation).
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

  const order = await prisma.order.create({
    data: {
      buyerId,
      sellerId: listing.sellerId,
      listingId: listing.id,
      status: OrderStatus.PENDING_PAYMENT,
      itemPrice: pricing.itemPrice.toFixed(2),
      shippingPrice: pricing.shippingPrice.toFixed(2),
      protectionFee: pricing.protectionFee.toFixed(2),
      totalPrice: pricing.totalPrice.toFixed(2),
      currency,
    },
  });

  // --- PaymentIntent (real Stripe if configured, sandbox stub otherwise) ---
  let paymentIntentId: string;
  let clientSecret: string;
  let sandbox = false;

  if (process.env.STRIPE_SECRET_KEY) {
    const intent = await stripe.paymentIntents.create({
      amount: toMinorUnits(pricing.totalPrice),
      currency: currency.toLowerCase(),
      // Escrow: capture to the platform; transfer to seller on release.
      metadata: {
        orderId: order.id,
        buyerId,
        sellerId: listing.sellerId,
        listingId: listing.id,
      },
    });
    paymentIntentId = intent.id;
    clientSecret = intent.client_secret ?? "";
  } else {
    sandbox = true;
    paymentIntentId = `pi_sandbox_${order.id}`;
    clientSecret = `${paymentIntentId}_secret_sandbox`;
    console.warn(
      `[checkout] SANDBOX PaymentIntent for order ${order.id} — STRIPE_SECRET_KEY not set. ` +
        "No real charge created. Configure Stripe keys before launch.",
    );
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripePaymentIntentId: paymentIntentId },
  });

  return NextResponse.json(
    {
      orderId: order.id,
      pricing,
      currency,
      addressId: savedAddress.id,
      clientSecret,
      sandbox,
    },
    { status: 201 },
  );
}
