import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderStatus, WalletState, DisputeStatus } from "@prisma/client";

// Money-critical: admin dispute resolution. Verify RBAC gating, the state
// machine guards, and that escrow moves correctly for each outcome — all
// without a database.
const db = vi.hoisted(() => ({
  dispute: { findUnique: vi.fn(), update: vi.fn() },
  order: { update: vi.fn() },
  walletTransaction: { update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

const requirePermission = vi.hoisted(() => vi.fn());
const RbacError = vi.hoisted(
  () =>
    class RbacError extends Error {
      status: number;
      constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = "RbacError";
      }
    },
);
vi.mock("@/lib/rbac", () => ({ requirePermission, RbacError }));

import { POST } from "@/app/api/admin/disputes/[id]/resolve/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/admin/disputes/d1/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const params = Promise.resolve({ id: "d1" });

const DISPUTED_ORDER = {
  id: "order_1",
  sellerId: "seller_1",
  status: OrderStatus.DISPUTED,
  walletTransactions: [
    { id: "wt_1", userId: "seller_1", state: WalletState.FROZEN },
  ],
};
const OPEN_DISPUTE = {
  id: "d1",
  status: DisputeStatus.UNDER_REVIEW,
  order: DISPUTED_ORDER,
};

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ userId: "admin_1" });
  db.dispute.findUnique.mockResolvedValue({ ...OPEN_DISPUTE });
});

describe("POST /api/admin/disputes/[id]/resolve", () => {
  it("rejects without the disputes.resolve permission (403)", async () => {
    requirePermission.mockRejectedValue(new RbacError(403, "nope"));
    const res = await POST(req({ outcome: "release" }), { params });
    expect(res.status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid outcome (400)", async () => {
    const res = await POST(req({ outcome: "steal" }), { params });
    expect(res.status).toBe(400);
  });

  it("release: order → RELEASED and seller escrow FROZEN → AVAILABLE", async () => {
    const res = await POST(req({ outcome: "release" }), { params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.orderStatus).toBe(OrderStatus.RELEASED);
    expect(json.payoutReleased).toBe(true);
    expect(db.walletTransaction.update).toHaveBeenCalledWith({
      where: { id: "wt_1" },
      data: { state: WalletState.AVAILABLE },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("refund: order → REFUNDED and escrow stays FROZEN (no payout)", async () => {
    const res = await POST(req({ outcome: "refund" }), { params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.orderStatus).toBe(OrderStatus.REFUNDED);
    expect(json.payoutReleased).toBe(false);
    // The seller's balance must NOT be released on a refund.
    expect(db.walletTransaction.update).not.toHaveBeenCalled();
  });

  it("refuses to resolve an already-resolved dispute (409)", async () => {
    db.dispute.findUnique.mockResolvedValue({
      ...OPEN_DISPUTE,
      status: DisputeStatus.RESOLVED_REFUND,
    });
    const res = await POST(req({ outcome: "release" }), { params });
    expect(res.status).toBe(409);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses when the order is not under dispute (409)", async () => {
    db.dispute.findUnique.mockResolvedValue({
      ...OPEN_DISPUTE,
      order: { ...DISPUTED_ORDER, status: OrderStatus.RELEASED },
    });
    const res = await POST(req({ outcome: "refund" }), { params });
    expect(res.status).toBe(409);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("returns 404 when the dispute does not exist", async () => {
    db.dispute.findUnique.mockResolvedValue(null);
    const res = await POST(req({ outcome: "release" }), { params });
    expect(res.status).toBe(404);
  });
});
