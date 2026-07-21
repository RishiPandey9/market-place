"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// Withdraw the full available balance. This cut only supports full-balance
// payouts, so the amount is fixed to `available` and shown for confirmation; the
// server re-validates it against the live balance (and the KYC gate).
export function WithdrawForm({
  available,
  currency,
}: {
  available: number;
  currency: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ withdrawn: number; sandbox: boolean } | null>(null);

  const nothingToWithdraw = available <= 0;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: available }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Withdrawal failed.");
        return;
      }
      setDone({ withdrawn: data.withdrawn, sandbox: Boolean(data.payoutSandbox) });
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
        <p className="font-medium">
          {fmt(done.withdrawn, currency)} withdrawal requested.
        </p>
        {done.sandbox && (
          <p className="mt-1 text-emerald-700">
            Sandbox mode: no real bank transfer was made. Wire Stripe Connect
            payouts before launch.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">Available to withdraw</span>
        <span className="text-lg font-semibold text-ink">
          {fmt(available, currency)}
        </span>
      </div>

      {nothingToWithdraw ? (
        <p className="mt-4 text-sm text-ink-soft">
          You have no cleared balance to withdraw yet. Funds become available
          once a buyer confirms delivery.
        </p>
      ) : (
        <button
          onClick={submit}
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Processing…" : `Withdraw ${fmt(available, currency)}`}
        </button>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
