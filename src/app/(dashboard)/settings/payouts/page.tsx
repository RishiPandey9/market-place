import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BankAccountsManager } from "@/components/settings/BankAccountsManager";

export const metadata = { title: "Payout accounts" };

// Settings → Payouts (SOW §05 "Add/edit bank account details", §08 withdrawals).
export default async function PayoutsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/settings/payouts");
  }

  const [accounts, withdrawals] = await Promise.all([
    prisma.bankAccount.findMany({
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
      },
    }),
    prisma.withdrawal.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Payout accounts</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Where your withdrawals are sent. Identity verification (Level 3) is
          required before your first withdrawal.
        </p>
        <div className="mt-6">
          <BankAccountsManager initial={accounts} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink">Withdrawal history</h2>
        {withdrawals.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No withdrawals yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-brand-50 rounded-2xl border border-brand-100">
            {withdrawals.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="text-ink">
                  {w.currency} {Number(w.amount).toFixed(2)}
                </span>
                <span className="flex items-center gap-3 text-xs text-ink-soft">
                  {new Date(w.createdAt).toLocaleDateString()}
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                    {w.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
