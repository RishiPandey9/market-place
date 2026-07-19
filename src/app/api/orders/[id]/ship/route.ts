import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertTransition } from "@/lib/escrow";
import { createShippingLabel, isShippingSandbox } from "@/lib/shipping";
import { OrderStatus } from "@prisma/client";

// POST /api/orders/[id]/ship — Seller marks shipped, generates a label (1.9).
// PAID → SHIPPED. Label/tracking come from the carrier aggregator (sandbox until
// SHIPPING_API_KEY is configured — see /src/lib/shipping.ts).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.sellerId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the seller can mark this order shipped" },
      { status: 403 },
    );
  }

  try {
    assertTransition(order.status, OrderStatus.SHIPPED);
  } catch {
    return NextResponse.json(
      { error: `Order in state ${order.status} cannot be shipped` },
      { status: 409 },
    );
  }

  const label = await createShippingLabel({ orderId: order.id });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.SHIPPED,
      shippingCarrier: label.carrier,
      trackingNumber: label.trackingNumber,
      labelUrl: label.labelUrl,
      shippedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    status: OrderStatus.SHIPPED,
    carrier: label.carrier,
    trackingNumber: label.trackingNumber,
    labelUrl: label.labelUrl,
    sandbox: isShippingSandbox(),
  });
}
