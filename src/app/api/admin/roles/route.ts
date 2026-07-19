import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requirePermission, RbacError } from "@/lib/rbac";
import { adminRoleSchema } from "@/lib/validation";
import { AdminRole } from "@prisma/client";

// POST /api/admin/roles — Assign or revoke an admin role (Phase 2).
// RBAC: requires `roles.manage` (SUPER_ADMIN only, per the role map). This is
// the most sensitive admin action: it can grant SUPER_ADMIN. Audit-logged.
export async function POST(req: Request) {
  let adminId: string;
  try {
    const ctx = await requirePermission("roles.manage");
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

  const parsed = adminRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { userId, role, op } = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const adminRole = role as AdminRole;

  if (op === "assign") {
    await prisma.$transaction([
      prisma.adminRoleAssignment.upsert({
        where: { userId_role: { userId, role: adminRole } },
        update: {},
        create: { userId, role: adminRole },
      }),
      prisma.auditLog.create({
        data: {
          userId: adminId,
          action: "admin_role_assigned",
          metadata: { targetUserId: userId, role },
        },
      }),
    ]);
  } else {
    // Guard: never allow removing the last SUPER_ADMIN — the console must always
    // have at least one owner.
    if (adminRole === AdminRole.SUPER_ADMIN) {
      const superAdmins = await prisma.adminRoleAssignment.count({
        where: { role: AdminRole.SUPER_ADMIN },
      });
      if (superAdmins <= 1) {
        return NextResponse.json(
          { error: "Cannot revoke the last SUPER_ADMIN" },
          { status: 409 },
        );
      }
    }
    await prisma.$transaction([
      prisma.adminRoleAssignment.deleteMany({
        where: { userId, role: adminRole },
      }),
      prisma.auditLog.create({
        data: {
          userId: adminId,
          action: "admin_role_revoked",
          metadata: { targetUserId: userId, role },
        },
      }),
    ]);
  }

  return NextResponse.json({ ok: true, userId, role, op });
}
