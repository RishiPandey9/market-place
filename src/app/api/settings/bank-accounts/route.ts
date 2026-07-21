import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createBankAccountSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

// Seller payout bank accounts (SOW §05 "Add/edit bank account details", §08).
// Owner-scoped by userId. SECURITY (CLAUDE.md #5): only tokenized/display fields
// are ever stored — `last4` for display and `providerAccountId` for the Stripe
// external-account token. A raw account number / IBAN must never reach this API.
// Archived rows are soft-deleted so historical withdrawals keep their reference.

// GET /api/settings/bank-accounts — list the user's (non-archived) accounts.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      label: true,
      holderName: true,
      country: true,
      currency: true,
      last4: true,
      verified: true,
      isDefault: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ bankAccounts });
}

// POST /api/settings/bank-accounts — add a payout account.
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

  const parsed = createBankAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { isDefault, label, providerAccountId, ...rest } = parsed.data;

  const existingCount = await prisma.bankAccount.count({
    where: { userId, archivedAt: null },
  });
  const makeDefault = isDefault || existingCount === 0;

  const bankAccount = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.bankAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.bankAccount.create({
      data: {
        userId,
        label: label ? label : null,
        holderName: rest.holderName,
        country: rest.country,
        currency: rest.currency,
        last4: rest.last4,
        providerAccountId: providerAccountId ? providerAccountId : null,
        // Real verification happens via the payment provider; a freshly added
        // account is unverified until Stripe confirms the external account.
        verified: false,
        isDefault: makeDefault,
      },
      select: {
        id: true,
        label: true,
        holderName: true,
        country: true,
        currency: true,
        last4: true,
        verified: true,
        isDefault: true,
        createdAt: true,
      },
    });
  });

  await recordAudit({
    action: "bank_account_added",
    userId,
    metadata: { bankAccountId: bankAccount.id, last4: bankAccount.last4 },
  });

  return NextResponse.json({ bankAccount }, { status: 201 });
}
