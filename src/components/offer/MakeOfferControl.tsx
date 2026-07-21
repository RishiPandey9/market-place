"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Buyer "Make an offer" control on the listing detail page (SOW §05).
// Server-validated by POST /api/offers (amount must be <= asking price).
export function MakeOfferControl({
  listingId,
  listPrice,
  currency,
}: {
  listingId: string;
  listPrice: string;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, amount, message: message.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not send offer");
      setBusy(false);
      return;
    }
    setBusy(false);
    setDone(true);
    setOpen(false);
    router.refresh();
  }

  if (done) {
    return (
      <p className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2.5 text-center text-sm font-medium text-brand-800">
        Offer sent — track it in{" "}
        <a href="/offers" className="underline">
          your offers
        </a>
        .
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="block w-full rounded-full border border-brand-300 px-6 py-3 text-center text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
      >
        Make an offer
      </button>
    );
  }

  const max = Number(listPrice);

  return (
    <div className="space-y-3 rounded-2xl border border-brand-100 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Make an offer</h3>
        <button
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-ink-soft hover:text-brand-700"
        >
          Cancel
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-soft">
          Your offer ({currency}) — asking {Number(listPrice).toFixed(2)}
        </label>
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          max={max}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Add a message (optional)"
        rows={2}
        className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || amount.trim().length === 0 || Number(amount) <= 0 || Number(amount) > max}
        className="w-full rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send offer"}
      </button>
    </div>
  );
}
