import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { availableBalance } from "@/lib/escrow";
import { WalletState } from "@prisma/client";
import { WithdrawForm } from "@/components/wallet/WithdrawForm";

export const metadata = { title: "Withdraw" };

// /wallet/withdraw — Request a payout of cleared earnings (Phase 2). The KYC
// gate is enforced both here (redirect unverified users to /verification) and,
// authoritatively, in POST /api/wallet/withdraw.
export default async function WithdrawPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/wallet/withdraw");

  const [user, rows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { verificationLevel: true },
    }),
    prisma.walletTransaction.findMany({
      where: { userId: session.user.id, state: WalletState.AVAILABLE },
      select: { amount: true, state: true, currency: true },
    }),
  ]);

  // KYC gate: unverified sellers cannot reach the withdraw form.
  if (user?.verificationLevel !== "LEVEL_3_ID_VERIFIED") {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-10">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight text-ink">
          Withdraw
        </h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
          <p className="font-medium">Identity verification required</p>
          <p className="mt-1">
            You must complete Level 3 identity verification before withdrawing.
          </p>
          <Link
            href="/verification"
            className="mt-3 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Verify my identity
          </Link>
        </div>
      </main>
    );
  }

  const available = availableBalance(rows.map((r) => ({ amount: Number(r.amount), state: r.state })));
  const currency = rows[0]?.currency ?? "GBP";

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-ink">
        Withdraw
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Transfer your available balance to your linked bank account.
      </p>
      <WithdrawForm available={available} currency={currency} />
    </main>
  );
}
