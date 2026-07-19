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
      <div className="rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
        <p className="font-medium">
          {fmt(done.withdrawn, currency)} withdrawal requested.
        </p>
        {done.sandbox && (
          <p className="mt-1 text-green-700">
            Sandbox mode: no real bank transfer was made. Wire Stripe Connect
            payouts before launch.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">Available to withdraw</span>
        <span className="text-lg font-semibold text-gray-900">
          {fmt(available, currency)}
        </span>
      </div>

      {nothingToWithdraw ? (
        <p className="mt-4 text-sm text-gray-500">
          You have no cleared balance to withdraw yet. Funds become available
          once a buyer confirms delivery.
        </p>
      ) : (
        <button
          onClick={submit}
          disabled={loading}
          className="mt-5 w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Processing…" : `Withdraw ${fmt(available, currency)}`}
        </button>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
