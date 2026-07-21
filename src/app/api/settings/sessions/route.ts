import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deviceLabel, revokeOtherSessions } from "@/lib/session";
import { recordAudit } from "@/lib/audit";

// GET /api/settings/sessions — the current user's active (non-revoked) sessions,
// most recent first, with a human-readable device label and a flag marking the
// session this request is coming from (so the UI can label "This device").
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.userSession.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      ip: true,
      userAgent: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });

  const sessions = rows.map((r) => ({
    id: r.id,
    device: deviceLabel(r.userAgent),
    ip: r.ip,
    createdAt: r.createdAt,
    lastSeenAt: r.lastSeenAt,
    current: r.id === session.user.sid,
  }));

  return NextResponse.json({ sessions });
}

// DELETE /api/settings/sessions — "sign out everywhere else": revoke every
// active session except the one making this request. Requires the current sid.
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sid = session.user.sid;
  if (!sid) {
    return NextResponse.json(
      { error: "Current session id unavailable" },
      { status: 409 },
    );
  }

  const revoked = await revokeOtherSessions(session.user.id, sid);
  await recordAudit({
    action: "session_revoked_others",
    userId: session.user.id,
    metadata: { revoked },
  });

  return NextResponse.json({ ok: true, revoked });
}
