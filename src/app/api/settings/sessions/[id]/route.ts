import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { revokeSession } from "@/lib/session";
import { recordAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/settings/sessions/[id] — remote logout of a single device. Revokes
// the session (soft delete); the target device's JWT is invalidated on its next
// request via the jwt() callback's isSessionActive check. Owner-scoped.
export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const ok = await revokeSession(session.user.id, id);
  if (!ok) {
    return NextResponse.json(
      { error: "Session not found or already revoked" },
      { status: 404 },
    );
  }

  await recordAudit({
    action: "session_revoked",
    userId: session.user.id,
    metadata: { sessionId: id, self: id === session.user.sid },
  });

  return NextResponse.json({ ok: true });
}
