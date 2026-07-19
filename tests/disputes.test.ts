import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderStatus, WalletState } from "@prisma/client";

// Mock Prisma so we exercise the dispute route's guards, freeze logic, and
// transaction shape without a database.
const db = vi.hoisted(() => ({
  order: { findUnique: vi.fn(), update: vi.fn() },
  dispute: { create: vi.fn() },
  walletTransaction: { update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

const getServerSession = vi.hoisted(() => vi.fn());
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { POST } from "@/app/api/disputes/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/disputes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const BASE_ORDER = {
  id: "order_1",
  buyerId: "buyer_1",
  sellerId: "seller_1",
  status: OrderStatus.PAID,
  dispute: null,
  walletTransactions: [
    { id: "wt_1", userId: "seller_1", state: WalletState.PENDING },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: "buyer_1" } });
  db.dispute.create.mockReturnValue({ __op: "dispute.create" });
  db.order.findUnique.mockResolvedValue({ ...BASE_ORDER });
});

describe("POST /api/disputes (money-critical freeze)", () => {
  it("requires authentication", async () => {
    getServerSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ orderId: "order_1", reason: "item not as described" }));
    expect(res.status).toBe(401);
  });

  it("rejects a non-participant", async () => {
    getServerSession.mockResolvedValue({ user: { id: "stranger" } });
    const res = await POST(makeRequest({ orderId: "order_1", reason: "item not as described" }));
    expect(res.status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("validates the reason length", async () => {
    const res = await POST(makeRequest({ orderId: "order_1", reason: "no" }));
    expect(res.status).toBe(400);
  });

  it("raises the dispute, sets DISPUTED, and FREEZES the seller's PENDING escrow", async () => {
    const res = await POST(makeRequest({ orderId: "order_1", reason: "item not as described" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.status).toBe(OrderStatus.DISPUTED);
    expect(json.payoutFrozen).toBe(true);

    // Wallet frozen.
    expect(db.walletTransaction.update).toHaveBeenCalledWith({
      where: { id: "wt_1" },
      data: { state: WalletState.FROZEN },
    });
    // All effects run in one transaction.
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("freezes an AVAILABLE balance too (dispute after release)", async () => {
    db.order.findUnique.mockResolvedValue({
      ...BASE_ORDER,
      status: OrderStatus.DELIVERED,
      walletTransactions: [{ id: "wt_1", userId: "seller_1", state: WalletState.AVAILABLE }],
    });
    const res = await POST(makeRequest({ orderId: "order_1", reason: "changed my mind, faulty" }));
    expect(res.status).toBe(201);
    expect(db.walletTransaction.update).toHaveBeenCalledWith({
      where: { id: "wt_1" },
      data: { state: WalletState.FROZEN },
    });
  });

  it("refuses a duplicate dispute", async () => {
    db.order.findUnique.mockResolvedValue({ ...BASE_ORDER, dispute: { id: "d_1" } });
    const res = await POST(makeRequest({ orderId: "order_1", reason: "item not as described" }));
    expect(res.status).toBe(409);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to dispute a completed (RELEASED) order", async () => {
    db.order.findUnique.mockResolvedValue({ ...BASE_ORDER, status: OrderStatus.RELEASED });
    const res = await POST(makeRequest({ orderId: "order_1", reason: "item not as described" }));
    expect(res.status).toBe(409);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
