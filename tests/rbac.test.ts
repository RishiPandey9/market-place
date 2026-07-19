import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminRole } from "@prisma/client";

// Mock next-auth + Prisma so we can exercise rbac.ts pure logic + DB-backed
// permission resolution without a database or a real session.
const getServerSession = vi.hoisted(() => vi.fn());
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const db = vi.hoisted(() => ({
  adminRoleAssignment: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import {
  getAdminContext,
  hasPermission,
  requirePermission,
  RbacError,
} from "@/lib/rbac";

beforeEach(() => {
  vi.clearAllMocks();
});

function asUser(id: string | null, roles: AdminRole[]) {
  getServerSession.mockResolvedValue(id ? { user: { id } } : null);
  db.adminRoleAssignment.findMany.mockResolvedValue(
    roles.map((role) => ({ role })),
  );
}

describe("RBAC permission mapping", () => {
  it("returns null context for an unauthenticated user", async () => {
    asUser(null, []);
    expect(await getAdminContext()).toBeNull();
  });

  it("returns null context for a user with no admin roles", async () => {
    asUser("u1", []);
    expect(await getAdminContext()).toBeNull();
  });

  it("grants SUPER_ADMIN every permission", async () => {
    asUser("u1", [AdminRole.SUPER_ADMIN]);
    const ctx = await getAdminContext();
    expect(ctx).not.toBeNull();
    expect(ctx!.permissions.has("roles.manage")).toBe(true);
    expect(ctx!.permissions.has("disputes.resolve")).toBe(true);
    expect(ctx!.permissions.has("users.manage")).toBe(true);
  });

  it("scopes a KYC_REVIEWER to verification only", async () => {
    asUser("u2", [AdminRole.KYC_REVIEWER]);
    const ctx = await getAdminContext();
    expect(ctx!.permissions.has("verification.review")).toBe(true);
    expect(ctx!.permissions.has("admin.access")).toBe(true);
    // Must NOT be able to resolve disputes or manage roles.
    expect(ctx!.permissions.has("disputes.resolve")).toBe(false);
    expect(ctx!.permissions.has("roles.manage")).toBe(false);
  });

  it("scopes a SUPPORT_AGENT to read-only surfaces", async () => {
    asUser("u3", [AdminRole.SUPPORT_AGENT]);
    const ctx = await getAdminContext();
    expect(ctx!.permissions.has("disputes.read")).toBe(true);
    expect(ctx!.permissions.has("disputes.resolve")).toBe(false);
    expect(ctx!.permissions.has("listings.moderate")).toBe(false);
  });

  it("unions permissions across multiple roles", async () => {
    asUser("u4", [AdminRole.MARKETING, AdminRole.LISTING_VERIFICATION_OFFICER]);
    const ctx = await getAdminContext();
    expect(ctx!.permissions.has("analytics.read")).toBe(true); // from MARKETING
    expect(ctx!.permissions.has("listings.moderate")).toBe(true); // from LVO
  });
});

describe("hasPermission / requirePermission", () => {
  it("hasPermission is false without the permission", async () => {
    asUser("u3", [AdminRole.SUPPORT_AGENT]);
    expect(await hasPermission("disputes.resolve")).toBe(false);
  });

  it("requirePermission throws 401 when unauthenticated", async () => {
    asUser(null, []);
    await expect(requirePermission("admin.access")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("requirePermission throws 403 when lacking the permission", async () => {
    asUser("u2", [AdminRole.KYC_REVIEWER]);
    await expect(
      requirePermission("disputes.resolve"),
    ).rejects.toBeInstanceOf(RbacError);
    await expect(
      requirePermission("disputes.resolve"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("requirePermission returns the context when authorized", async () => {
    asUser("u1", [AdminRole.SUPER_ADMIN]);
    const ctx = await requirePermission("disputes.resolve");
    expect(ctx.userId).toBe("u1");
  });
});
