import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ticketReplySchema } from "@/lib/validation";
import { statusAfterReply, userCanReply } from "@/lib/ticket";
import { recordAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/support/tickets/[id] — full thread for a ticket the caller owns.
export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      requesterId: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fromStaff: true,
          body: true,
          createdAt: true,
        },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  // Owner-scoped: a user may only read their own ticket. (Agents use the admin
  // API, which is RBAC-gated separately.)
  if (ticket.requesterId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ticket });
}

// POST /api/support/tickets/[id] — the requester adds a reply. Reopens the
// ticket (OPEN) so staff see it again. Blocked once the ticket is CLOSED.
export async function POST(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ticketReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, requesterId: true, status: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (ticket.requesterId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!userCanReply(ticket.status)) {
    return NextResponse.json(
      { error: "This ticket is closed. Open a new ticket instead." },
      { status: 409 },
    );
  }

  const nextStatus = statusAfterReply(ticket.status, false);

  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: session.user.id,
        fromStaff: false,
        body: parsed.data.body,
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: nextStatus, lastReplyAt: new Date() },
    }),
  ]);

  await recordAudit({
    action: "support_ticket_reply",
    userId: session.user.id,
    metadata: { ticketId: ticket.id, fromStaff: false },
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
