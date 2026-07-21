import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requirePermission, RbacError } from "@/lib/rbac";
import { ticketReplySchema, ticketStatusSchema } from "@/lib/validation";
import { statusAfterReply, agentCanSetStatus } from "@/lib/ticket";
import { TicketStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/support/tickets/[id] — full thread + requester. RBAC:
// `support.read`.
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    await requirePermission("support.read");
  } catch (e) {
    if (e instanceof RbacError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
  const { id } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
      requester: { select: { id: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fromStaff: true, body: true, createdAt: true },
      },
    },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}

// POST /api/admin/support/tickets/[id] — agent reply. RBAC: `support.manage`.
// Flips the ticket to PENDING (awaiting the user).
export async function POST(req: Request, { params }: RouteContext) {
  let agentId: string;
  try {
    const ctx = await requirePermission("support.manage");
    agentId = ctx.userId;
  } catch (e) {
    if (e instanceof RbacError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
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
    select: { id: true, status: true, requesterId: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (ticket.status === TicketStatus.CLOSED) {
    return NextResponse.json(
      { error: "Reopen the ticket before replying." },
      { status: 409 },
    );
  }

  const nextStatus = statusAfterReply(ticket.status, true);

  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: agentId,
        fromStaff: true,
        body: parsed.data.body,
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: nextStatus, lastReplyAt: new Date() },
    }),
    // Notify the requester there's a reply (best-effort in-app notification).
    prisma.notification.create({
      data: {
        userId: ticket.requesterId,
        channel: "EMAIL",
        title: "Support replied to your ticket",
        body: "Our support team has responded. Open your ticket to read the reply.",
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: agentId,
        action: "support_ticket_reply",
        metadata: { ticketId: ticket.id, fromStaff: true },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, status: nextStatus });
}

// PATCH /api/admin/support/tickets/[id] — agent changes status (resolve / close
// / reopen). RBAC: `support.manage`. Guarded by the ticket state machine.
export async function PATCH(req: Request, { params }: RouteContext) {
  let agentId: string;
  try {
    const ctx = await requirePermission("support.manage");
    agentId = ctx.userId;
  } catch (e) {
    if (e instanceof RbacError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ticketStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const target = parsed.data.status as TicketStatus;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!agentCanSetStatus(ticket.status, target)) {
    return NextResponse.json(
      { error: `Cannot move ticket from ${ticket.status} to ${target}` },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: target,
        resolvedAt:
          target === TicketStatus.RESOLVED ? new Date() : undefined,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: agentId,
        action: "support_ticket_status_changed",
        metadata: { ticketId: ticket.id, from: ticket.status, to: target },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, status: target });
}
