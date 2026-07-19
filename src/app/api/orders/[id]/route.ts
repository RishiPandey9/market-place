import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/orders/[id] — Order detail + tracking (route map).
// Visible only to the order's buyer or seller.
export async function GET(
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
    include: {
      listing: { select: { id: true, title: true, images: true } },
      walletTransactions: true,
      dispute: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const userId = session.user.id;
  if (order.buyerId !== userId && order.sellerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    order: {
      ...order,
      itemPrice: order.itemPrice.toString(),
      shippingPrice: order.shippingPrice.toString(),
      protectionFee: order.protectionFee.toString(),
      totalPrice: order.totalPrice.toString(),
      walletTransactions: order.walletTransactions.map((w) => ({
        ...w,
        amount: w.amount.toString(),
      })),
    },
  });
}
