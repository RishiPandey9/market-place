import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createRatingSchema } from "@/lib/validation";

// POST /api/ratings — Leave a rating after a completed order (Phase 1.10).
//
// NOTE: /api/ratings is not in the documented route map; added here because
// ratings (1.10) need an endpoint and there is no dedicated one. Flagged.
//
// Rules: only the order's buyer or seller may rate, only once the order is
// RELEASED (completed), each party rates the OTHER, and only one rating per
// author per order (enforced by a pre-check).
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

  const parsed = createRatingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { orderId, score, comment } = parsed.data;
  const userId = session.user.id;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, buyerId: true, sellerId: true, status: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.buyerId !== userId && order.sellerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "RELEASED") {
    return NextResponse.json(
      { error: "You can only rate a completed order" },
      { status: 409 },
    );
  }

  // One rating per author per order.
  const existing = await prisma.rating.findFirst({
    where: { orderId, authorId: userId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You have already rated this order" },
      { status: 409 },
    );
  }

  const targetId = order.buyerId === userId ? order.sellerId : order.buyerId;

  const rating = await prisma.rating.create({
    data: {
      orderId,
      authorId: userId,
      targetId,
      score,
      comment: comment || null,
    },
    select: { id: true, score: true, comment: true, targetId: true, createdAt: true },
  });

  return NextResponse.json({ rating }, { status: 201 });
}
