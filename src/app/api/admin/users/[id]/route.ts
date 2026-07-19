import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requirePermission, RbacError } from "@/lib/rbac";
import { suspendUserSchema } from "@/lib/validation";

// PATCH /api/admin/users/[id] — Admin suspends / reactivates a user (Phase 2).
// RBAC: requires `users.manage`. Audit-logged. A suspended user is blocked at
// sign-in (see authorize()/session callback) and cannot transact.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let adminId: string;
  try {
    const ctx = await requirePermission("users.manage");
    adminId = ctx.userId;
  } catch (e) {
    if (e instanceof RbacError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = suspendUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { suspended, note } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, suspended: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { suspended, suspendedAt: suspended ? new Date() : null },
    }),
    prisma.auditLog.create({
      data: {
        userId: adminId,
        action: suspended ? "user_suspended" : "user_reactivated",
        metadata: { targetUserId: user.id, note: note || null },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, userId: user.id, suspended });
}
