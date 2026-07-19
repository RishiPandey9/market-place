import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderStatus, WalletState } from "@prisma/client";

// ---------------------------------------------------------------------------
// Mocks. We mock the Prisma client and the Stripe SDK so the test exercises the
// webhook handler's logic (signature check, idempotency, order state machine)
// without a database or network.
// ---------------------------------------------------------------------------

const db = vi.hoisted(() => ({
  auditLog: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  order: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  walletTransaction: {
    create: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  // $transaction runs the array of prepared operations.
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}));

vi.mock("@/lib/db", () => ({ prisma: db }));

const constructEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent } },
}));

// Import after mocks are registered.
import { POST } from "@/app/api/webhooks/stripe/route";

function makeRequest(body: string, signature: string | null): Request {
  const headers = new Headers();
  if (signature !== null) headers.set("stripe-signature", signature);
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  });
}

const ORDER = {
  id: "order_1",
  sellerId: "seller_1",
  status: OrderStatus.PENDING_PAYMENT,
  itemPrice: "45.00",
  currency: "GBP",
  stripePaymentIntentId: "pi_123",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  // Default: event not seen before.
  db.auditLog.findFirst.mockResolvedValue(null);
  db.auditLog.create.mockResolvedValue({ id: "log_1" });
});

describe("POST /api/webhooks/stripe", () => {
  it("rejects a request with no signature header", async () => {
    const res = await POST(makeRequest("{}", null));
    expect(res.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await POST(makeRequest("{}", "sig"));
    expect(res.status).toBe(400);
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it("marks the order PAID and creates a PENDING wallet transaction on payment_intent.succeeded", async () => {
    const event = {
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_123" } },
    };
    constructEvent.mockReturnValue(event);
    db.order.findFirst.mockResolvedValue({ ...ORDER });

    const res = await POST(makeRequest(JSON.stringify(event), "sig"));

    expect(res.status).toBe(200);

    // Order moved to PAID.
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { status: OrderStatus.PAID },
    });

    // Escrow wallet transaction created in PENDING state for the seller.
    expect(db.walletTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: "seller_1",
        orderId: "order_1",
        amount: "45.00",
        currency: "GBP",
        state: WalletState.PENDING,
      },
    });

    // Event recorded for idempotency.
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "stripe_webhook",
        metadata: { eventId: "evt_1", type: "payment_intent.succeeded" },
      },
    });
  });

  it("is idempotent — a replayed event does not re-apply side effects", async () => {
    const event = {
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_123" } },
    };
    constructEvent.mockReturnValue(event);
    // Event already recorded.
    db.auditLog.findFirst.mockResolvedValue({ id: "log_existing" });

    const res = await POST(makeRequest(JSON.stringify(event), "sig"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.duplicate).toBe(true);
    expect(db.order.update).not.toHaveBeenCalled();
    expect(db.walletTransaction.create).not.toHaveBeenCalled();
  });

  it("does not move an order that is already past PENDING_PAYMENT", async () => {
    const event = {
      id: "evt_2",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_123" } },
    };
    constructEvent.mockReturnValue(event);
    db.order.findFirst.mockResolvedValue({
      ...ORDER,
      status: OrderStatus.SHIPPED,
    });

    const res = await POST(makeRequest(JSON.stringify(event), "sig"));

    expect(res.status).toBe(200);
    expect(db.order.update).not.toHaveBeenCalled();
    expect(db.walletTransaction.create).not.toHaveBeenCalled();
  });

  it("promotes a LEVEL_1 seller to LEVEL_2 when Connect onboarding completes", async () => {
    const event = {
      id: "evt_3",
      type: "account.updated",
      data: {
        object: {
          id: "acct_1",
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: true,
        },
      },
    };
    constructEvent.mockReturnValue(event);
    db.user.findFirst.mockResolvedValue({
      id: "seller_1",
      verificationLevel: "LEVEL_1_BASIC",
    });

    const res = await POST(makeRequest(JSON.stringify(event), "sig"));

    expect(res.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "seller_1" },
      data: { verificationLevel: "LEVEL_2_SELLER" },
    });
  });
});
