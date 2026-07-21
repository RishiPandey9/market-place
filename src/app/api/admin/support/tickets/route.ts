import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requirePermission, RbacError } from "@/lib/rbac";
import { TicketStatus } from "@prisma/client";

// GET /api/admin/support/tickets — support queue. RBAC: `support.read`. Optional
// ?status= filter; defaults to the actionable queue (OPEN + PENDING) newest
// activity first.
export async function GET(req: Request) {
  try {
    await requirePermission("support.read");
  } catch (e) {
    if (e instanceof RbacError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const validStatus =
    statusParam && statusParam in TicketStatus
      ? (statusParam as TicketStatus)
      : null;

  const where = validStatus
    ? { status: validStatus }
    : { status: { in: [TicketStatus.OPEN, TicketStatus.PENDING] } };

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { lastReplyAt: "desc" },
    take: 100,
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
      lastReplyAt: true,
      requester: { select: { email: true } },
    },
  });

  return NextResponse.json({ tickets });
}
