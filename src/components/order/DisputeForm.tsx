"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Buyer/seller raises a dispute on an order → freezes payout for manual review.
export function DisputeForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not raise dispute");
      setBusy(false);
      return;
    }
    router.push(`/orders/${orderId}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={5}
        placeholder="Describe the problem (e.g. item not as described, not received)…"
        className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || reason.trim().length < 10}
        className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Raise dispute"}
      </button>
      <p className="text-xs text-ink-soft">
        Raising a dispute freezes the seller&apos;s payout until our team reviews
        it.
      </p>
    </div>
  );
}
