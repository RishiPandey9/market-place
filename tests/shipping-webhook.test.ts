import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { OrderStatus } from "@prisma/client";

// Mock Prisma so we exercise the shipping webhook's signature check,
// idempotency, and order state transition without a database.
const db = vi.hoisted(() => ({
  auditLog: { findFirst: vi.fn(), create: vi.fn() },
  order: { findFirst: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { POST } from "@/app/api/webhooks/shipping/route";

const SECRET = "shipsec_test";

function sign(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

function makeRequest(body: string, signature: string | null): Request {
  const headers = new Headers();
  if (signature !== null) headers.set("x-shipping-signature", signature);
  return new Request("http://localhost/api/webhooks/shipping", {
    method: "POST",
    headers,
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHIPPING_WEBHOOK_SECRET = SECRET;
  db.auditLog.findFirst.mockResolvedValue(null);
  db.auditLog.create.mockResolvedValue({ id: "log_1" });
});

describe("POST /api/webhooks/shipping", () => {
  it("returns 500 when the webhook secret is not configured", async () => {
    delete process.env.SHIPPING_WEBHOOK_SECRET;
    const body = JSON.stringify({ id: "e1", type: "tracking.delivered", trackingNumber: "T1" });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(500);
  });

  it("rejects a missing signature", async () => {
    const body = JSON.stringify({ id: "e1", type: "tracking.delivered", trackingNumber: "T1" });
    const res = await POST(makeRequest(body, null));
    expect(res.status).toBe(400);
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature", async () => {
    const body = JSON.stringify({ id: "e1", type: "tracking.delivered", trackingNumber: "T1" });
    const res = await POST(makeRequest(body, "deadbeef"));
    expect(res.status).toBe(400);
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it("moves a SHIPPED order to DELIVERED and sets autoConfirmAt on tracking.delivered", async () => {
    const body = JSON.stringify({ id: "e2", type: "tracking.delivered", trackingNumber: "SBX123" });
    db.order.findFirst.mockResolvedValue({ id: "order_1", status: OrderStatus.SHIPPED, trackingNumber: "SBX123" });

    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);

    expect(db.order.update).toHaveBeenCalledTimes(1);
    const arg = db.order.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "order_1" });
    expect(arg.data.status).toBe(OrderStatus.DELIVERED);
    expect(arg.data.deliveredAt).toBeInstanceOf(Date);
    expect(arg.data.autoConfirmAt).toBeInstanceOf(Date);
    // auto-confirm is after delivery
    expect(arg.data.autoConfirmAt.getTime()).toBeGreaterThan(arg.data.deliveredAt.getTime());
  });

  it("does not move an order that is not in a deliverable state", async () => {
    const body = JSON.stringify({ id: "e3", type: "tracking.delivered", trackingNumber: "SBX123" });
    db.order.findFirst.mockResolvedValue({ id: "order_1", status: OrderStatus.RELEASED, trackingNumber: "SBX123" });

    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it("is idempotent — a replayed event does not re-apply side effects", async () => {
    const body = JSON.stringify({ id: "e2", type: "tracking.delivered", trackingNumber: "SBX123" });
    db.auditLog.findFirst.mockResolvedValue({ id: "log_existing" });

    const res = await POST(makeRequest(body, sign(body)));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.duplicate).toBe(true);
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it("acknowledges non-delivery tracking events without changing order state", async () => {
    const body = JSON.stringify({ id: "e4", type: "tracking.in_transit", trackingNumber: "SBX123" });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(db.order.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalled();
  });
});
