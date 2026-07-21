import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTicketSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

// GET /api/support/tickets — the signed-in user's own tickets (newest activity
// first). Owner-scoped: a user only ever sees tickets they opened.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tickets = await prisma.supportTicket.findMany({
    where: { requesterId: session.user.id },
    orderBy: { lastReplyAt: "desc" },
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
      lastReplyAt: true,
    },
  });

  return NextResponse.json({ tickets });
}

// POST /api/support/tickets — open a new ticket with its first message. The
// ticket + first message are created atomically. Starts in OPEN (awaiting
// staff).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { subject, category, message } = parsed.data;

  const ticket = await prisma.supportTicket.create({
    data: {
      requesterId: session.user.id,
      subject,
      category,
      messages: {
        create: {
          authorId: session.user.id,
          fromStaff: false,
          body: message,
        },
      },
    },
    select: { id: true },
  });

  await recordAudit({
    action: "support_ticket_opened",
    userId: session.user.id,
    metadata: { ticketId: ticket.id, category },
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
