import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { availableBalance, round2 } from "@/lib/escrow";
import { WalletState } from "@prisma/client";

export const metadata = { title: "Wallet" };

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const STATE_LABEL: Record<WalletState, string> = {
  PENDING: "In escrow",
  AVAILABLE: "Available",
  FROZEN: "Frozen (dispute)",
  WITHDRAWN: "Withdrawn",
};

// /wallet — Seller earnings (Phase 2). Shows escrow balances broken out by
// state and the transaction history. Withdrawals of the AVAILABLE balance are
// gated on Level 3 identity verification (see /verification).
export default async function WalletPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/wallet");

  const [user, txns] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { verificationLevel: true },
    }),
    prisma.walletTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { order: { select: { id: true, listing: { select: { title: true } } } } },
    }),
  ]);

  const rows = txns.map((t) => ({ amount: Number(t.amount), state: t.state }));
  const available = availableBalance(rows);
  const pending = round2(
    rows.filter((r) => r.state === WalletState.PENDING).reduce((s, r) => s + r.amount, 0),
  );
  const frozen = round2(
    rows.filter((r) => r.state === WalletState.FROZEN).reduce((s, r) => s + r.amount, 0),
  );
  const currency = txns[0]?.currency ?? "GBP";
  const isVerified = user?.verificationLevel === "LEVEL_3_ID_VERIFIED";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">
        Wallet
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand-100 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Available</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {fmt(available, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">In escrow</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {fmt(pending, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Frozen</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {fmt(frozen, currency)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        {isVerified ? (
          <Link
            href="/wallet/withdraw"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Withdraw {fmt(available, currency)}
          </Link>
        ) : (
          <>
            <span
              className="cursor-not-allowed rounded-xl bg-brand-100 px-4 py-2 text-sm font-medium text-ink-soft"
              title="Complete identity verification to withdraw"
            >
              Withdraw
            </span>
            <Link href="/verification" className="text-sm font-medium text-brand-700 underline hover:text-brand-800">
              Verify your identity to withdraw
            </Link>
          </>
        )}
      </div>

      <h2 className="mb-3 mt-10 text-sm font-semibold text-ink">Transactions</h2>
      {txns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 py-12 text-center">
          <p className="text-sm text-ink-soft">No wallet activity yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-brand-50 rounded-2xl border border-brand-100">
          {txns.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  {t.order.listing.title}
                </p>
                <p className="text-xs text-ink-soft">
                  {STATE_LABEL[t.state]} · {t.createdAt.toLocaleDateString()}
                </p>
              </div>
              <span className="text-sm font-medium text-ink">
                {fmt(Number(t.amount), t.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
