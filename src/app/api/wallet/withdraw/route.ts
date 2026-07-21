import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withdrawSchema } from "@/lib/validation";
import {
  availableBalance,
  checkWithdrawalEligibility,
  canWalletTransition,
  initialWithdrawalStatus,
} from "@/lib/escrow";
import { isKycSandbox } from "@/lib/kyc";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/ratelimit";
import { recordAudit } from "@/lib/audit";
import { WalletState, Prisma } from "@prisma/client";

// POST /api/wallet/withdraw — Seller requests a payout of cleared escrow (Phase 2).
//
// Money-critical (CLAUDE.md #7 → covered by tests/escrow.test.ts) and KYC-gated
// (#8): the seller MUST have reached LEVEL_3_ID_VERIFIED before any withdrawal is
// permitted, enforced via escrow.checkWithdrawalEligibility. Only AVAILABLE
// escrow rows (cleared through the buyer's confirmation / auto-confirm) are
// withdrawable; PENDING (in escrow) and FROZEN (disputed) balances are excluded.
//
// This cut pays out the full cleared balance in one payout: the request `amount`
// is a confirmation guard that must equal the server-computed available balance,
// so the client can't under/over-withdraw against a stale view. Partial payouts
// (splitting a row) are a later enhancement.
//
// SANDBOX FLAG: no real bank transfer is performed — rows are marked WITHDRAWN
// and an audit row is written. Wire this to Stripe Connect payouts (via
// /src/lib/stripe.ts) before launch; the KYC gate above is real in both modes.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Money-movement abuse guard: cap withdrawal attempts per user.
  const limit = rateLimit(`withdraw:${session.user.id}`, RATE_LIMITS.withdraw);
  if (!limit.ok) {
    await recordAudit({
      action: "withdraw_rate_limited",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Too many withdrawal attempts. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = withdrawSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, verificationLevel: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // A verified payout destination is required before any withdrawal (SOW §08
  // step 5). The default (or only) non-archived bank account is used.
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { userId: user.id, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: { id: true, currency: true },
  });
  if (!bankAccount) {
    return NextResponse.json(
      {
        error:
          "Add a payout bank account in Settings → Payouts before withdrawing.",
        reason: "no_bank_account",
      },
      { status: 400 },
    );
  }

  // Load the seller's cleared escrow rows. Decimal → number for the pure check.
  const availableRows = await prisma.walletTransaction.findMany({
    where: { userId: user.id, state: WalletState.AVAILABLE },
    select: { id: true, amount: true, state: true, currency: true },
  });
  const wallet = availableRows.map((r) => ({
    amount: Number(r.amount),
    state: r.state,
  }));

  const check = checkWithdrawalEligibility({
    verificationLevel: user.verificationLevel,
    wallet,
    requestedAmount: parsed.data.amount,
  });

  if (!check.ok) {
    if (check.reason === "kyc_required") {
      // 403: identity verification is a hard prerequisite, not a bad request.
      return NextResponse.json(
        {
          error:
            "Identity verification (Level 3) is required before you can withdraw.",
          reason: check.reason,
          verificationLevel: user.verificationLevel,
          availableBalance: check.availableBalance,
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        error:
          check.reason === "insufficient_available"
            ? "Requested amount exceeds your available balance."
            : "Invalid withdrawal amount.",
        reason: check.reason,
        availableBalance: check.availableBalance,
      },
      { status: 400 },
    );
  }

  // Confirmation guard: this cut withdraws the entire cleared balance at once.
  if (parsed.data.amount !== check.availableBalance) {
    return NextResponse.json(
      {
        error:
          "Withdraw the full available balance. Partial withdrawals aren't supported yet.",
        reason: "must_withdraw_full_balance",
        availableBalance: check.availableBalance,
      },
      { status: 400 },
    );
  }

  // Every row must be able to transition AVAILABLE → WITHDRAWN.
  for (const row of availableRows) {
    if (!canWalletTransition(row.state, WalletState.WITHDRAWN)) {
      return NextResponse.json(
        { error: "One or more balances cannot be withdrawn." },
        { status: 409 },
      );
    }
  }

  const rowIds = availableRows.map((r) => r.id);
  // Currency of the payout — taken from the cleared rows (all one currency at
  // the single-market launch), falling back to the bank account's currency.
  const payoutCurrency = availableRows[0]?.currency ?? bankAccount.currency;

  // SANDBOX FLAG: no real bank transfer happens yet. The Withdrawal row is
  // recorded as PAID to reflect the sandbox escrow-release; wire this to a real
  // Stripe Connect payout (status REQUESTED → PROCESSING → PAID via webhook)
  // before launch. The KYC gate above is real in both modes.
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.walletTransaction.updateMany({
      where: { id: { in: rowIds }, state: WalletState.AVAILABLE },
      data: { state: WalletState.WITHDRAWN },
    }),
    prisma.withdrawal.create({
      data: {
        userId: user.id,
        bankAccountId: bankAccount.id,
        amount: check.availableBalance,
        currency: payoutCurrency,
        status: initialWithdrawalStatus(isKycSandbox()),
        processedAt: isKycSandbox() ? new Date() : null,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "wallet_withdraw",
        metadata: {
          amount: check.availableBalance,
          transactionIds: rowIds,
          bankAccountId: bankAccount.id,
          kycSandbox: isKycSandbox(),
        },
      },
    }),
  ];
  await prisma.$transaction(ops);

  return NextResponse.json({
    ok: true,
    withdrawn: check.availableBalance,
    transactions: rowIds.length,
    // Flag that no real bank payout happened yet (sandbox KYC/payout path).
    payoutSandbox: isKycSandbox(),
  });
}
