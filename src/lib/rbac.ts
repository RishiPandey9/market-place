import { getServerSession } from "next-auth";
import { AdminRole } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ============================================================================
// RBAC — permission checks per AdminRole (technical-foundation.md §/lib/rbac.ts)
//
// Every /admin page and every admin API handler that touches user/order/listing
// data MUST go through requirePermission()/hasPermission() here. Admin roles are
// stored in the AdminRoleAssignment table and looked up fresh on each request
// (NOT baked into the JWT) so that revoking a role takes effect immediately.
// ============================================================================

// The discrete capabilities an admin action can require. Kept coarse-grained,
// one per admin surface, so route gating reads clearly.
export type Permission =
  | "admin.access" // may open the admin console at all
  | "users.read"
  | "users.manage" // suspend / edit / assign roles
  | "listings.read"
  | "listings.moderate" // approve / reject / hide listings
  | "orders.read"
  | "disputes.read"
  | "disputes.resolve" // refund or release escrow
  | "verification.read"
  | "verification.review" // approve / reject KYC
  | "support.read" // view support tickets
  | "support.manage" // reply to / change status of tickets
  | "roles.manage" // assign/revoke admin roles
  | "analytics.read";

// Map each AdminRole to the permissions it grants. SUPER_ADMIN gets everything.
// This mirrors the role list in the schema's AdminRole enum.
const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  [AdminRole.SUPER_ADMIN]: [
    "admin.access",
    "users.read",
    "users.manage",
    "listings.read",
    "listings.moderate",
    "orders.read",
    "disputes.read",
    "disputes.resolve",
    "verification.read",
    "verification.review",
    "support.read",
    "support.manage",
    "roles.manage",
    "analytics.read",
  ],
  [AdminRole.MANAGER]: [
    "admin.access",
    "users.read",
    "listings.read",
    "listings.moderate",
    "orders.read",
    "disputes.read",
    "disputes.resolve",
    "verification.read",
    "support.read",
    "support.manage",
    "analytics.read",
  ],
  [AdminRole.LISTING_VERIFICATION_OFFICER]: [
    "admin.access",
    "listings.read",
    "listings.moderate",
  ],
  [AdminRole.KYC_REVIEWER]: [
    "admin.access",
    "verification.read",
    "verification.review",
  ],
  [AdminRole.SUPPORT_AGENT]: [
    "admin.access",
    "users.read",
    "orders.read",
    "disputes.read",
    "support.read",
    "support.manage",
  ],
  [AdminRole.TRUST_AND_SAFETY]: [
    "admin.access",
    "users.read",
    "users.manage",
    "listings.read",
    "listings.moderate",
    "orders.read",
    "disputes.read",
    "disputes.resolve",
  ],
  [AdminRole.MARKETING]: ["admin.access", "analytics.read"],
  [AdminRole.SEO_CONTENT]: ["admin.access", "listings.read"],
  [AdminRole.FINANCE]: [
    "admin.access",
    "orders.read",
    "disputes.read",
    "analytics.read",
  ],
};

export type AdminContext = {
  userId: string;
  roles: AdminRole[];
  permissions: Set<Permission>;
};

/** Collapse a set of roles into the union of their permissions. */
function permissionsForRoles(roles: AdminRole[]): Set<Permission> {
  const perms = new Set<Permission>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role] ?? []) perms.add(p);
  }
  return perms;
}

/**
 * Load the current session's admin context (roles + permissions) from the DB.
 * Returns null if there is no authenticated user or the user has no admin roles.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const assignments = await prisma.adminRoleAssignment.findMany({
    where: { userId },
    select: { role: true },
  });
  if (assignments.length === 0) return null;

  const roles = assignments.map((a) => a.role);
  return { userId, roles, permissions: permissionsForRoles(roles) };
}

/** Non-throwing check: does the current user hold `permission`? */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const ctx = await getAdminContext();
  return ctx?.permissions.has(permission) ?? false;
}

/** Thrown by requirePermission so API handlers can map to an HTTP status. */
export class RbacError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "RbacError";
  }
}

/**
 * Enforce that the current user is authenticated AND holds `permission`.
 * Returns the AdminContext on success; throws RbacError otherwise.
 *
 * Use in admin API route handlers:
 *   try { await requirePermission("disputes.resolve"); }
 *   catch (e) { return rbacResponse(e); }
 */
export async function requirePermission(
  permission: Permission,
): Promise<AdminContext> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new RbacError(401, "Not authenticated");
  }
  const ctx = await getAdminContext();
  if (!ctx || !ctx.permissions.has(permission)) {
    throw new RbacError(403, "You do not have permission to perform this action");
  }
  return ctx;
}
