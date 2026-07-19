import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createMessageSchema } from "@/lib/validation";

// Messaging (Phase 1.10). Conversations are scoped to an order; only that
// order's buyer and seller may read or post. Real-time WebSocket chat is
// DEFERRED per the plan — the client polls GET /api/messages?orderId=... on an
// interval instead. Flagged as interim; swap for WebSockets in a later phase.

// Shared guard: the signed-in user must be a participant in the order.
async function assertParticipant(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, buyerId: true, sellerId: true },
  });
  if (!order) return { ok: false as const, status: 404, error: "Order not found" };
  if (order.buyerId !== userId && order.sellerId !== userId) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, order };
}

// GET /api/messages?orderId=...&after=<ISO> — poll for the conversation.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const guard = await assertParticipant(orderId, session.user.id);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // Optional incremental fetch: only messages created after a timestamp.
  const after = req.nextUrl.searchParams.get("after");
  const afterDate = after ? new Date(after) : null;

  const messages = await prisma.message.findMany({
    where: {
      orderId,
      ...(afterDate && !Number.isNaN(afterDate.getTime())
        ? { createdAt: { gt: afterDate } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      senderId: true,
      content: true,
      imageUrl: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ messages, currentUserId: session.user.id });
}

// POST /api/messages — send a message in an order conversation.
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

  const parsed = createMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const guard = await assertParticipant(parsed.data.orderId, session.user.id);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const message = await prisma.message.create({
    data: {
      orderId: parsed.data.orderId,
      senderId: session.user.id,
      content: parsed.data.content,
      imageUrl: parsed.data.imageUrl || null,
    },
    select: {
      id: true,
      senderId: true,
      content: true,
      imageUrl: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}
