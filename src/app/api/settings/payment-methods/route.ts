import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createPaymentMethodSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

// Buyer payment methods (SOW §05 "Add/edit payment method — cards/wallets").
// Owner-scoped by userId. SECURITY (PCI-DSS, CLAUDE.md #5): card numbers/CVCs
// are NEVER accepted or stored. The client tokenizes the card with Stripe.js and
// posts only the resulting PaymentMethod id plus safe display metadata (brand +
// last4 + expiry). Archived rows are soft-deleted.

// GET /api/settings/payment-methods — list the user's saved cards.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      brand: true,
      last4: true,
      expMonth: true,
      expYear: true,
      isDefault: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ paymentMethods });
}

// POST /api/settings/payment-methods — save a tokenized card.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createPaymentMethodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { isDefault, brand, last4, providerMethodId, expMonth, expYear } =
    parsed.data;

  const existingCount = await prisma.paymentMethod.count({
    where: { userId, archivedAt: null },
  });
  const makeDefault = isDefault || existingCount === 0;

  const paymentMethod = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.paymentMethod.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.paymentMethod.create({
      data: {
        userId,
        providerMethodId,
        brand: brand ? brand : null,
        last4: last4 ? last4 : null,
        expMonth: expMonth ?? null,
        expYear: expYear ?? null,
        isDefault: makeDefault,
      },
      select: {
        id: true,
        brand: true,
        last4: true,
        expMonth: true,
        expYear: true,
        isDefault: true,
        createdAt: true,
      },
    });
  });

  await recordAudit({
    action: "payment_method_added",
    userId,
    metadata: { paymentMethodId: paymentMethod.id, brand: paymentMethod.brand },
  });

  return NextResponse.json({ paymentMethod }, { status: 201 });
}
