"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "accept" | "decline" | "counter" | "withdraw";

// Per-offer action buttons on the /offers inbox. `canAct` is computed
// server-side (whose turn it is) and passed in; the API re-checks it.
export function OfferRowControl({
  offerId,
  listingId,
  role,
  status,
  canAccept,
  canRespond,
  canWithdraw,
  accepted,
}: {
  offerId: string;
  listingId: string;
  role: "buyer" | "seller";
  status: string;
  canAccept: boolean;
  canRespond: boolean; // decline / counter available (same turn as accept)
  canWithdraw: boolean;
  accepted: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countering, setCountering] = useState(false);
  const [counterAmount, setCounterAmount] = useState("");

  async function act(action: Action, amount?: string) {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/offers/${offerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(amount !== undefined ? { action, amount } : { action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Action failed");
      setBusy(null);
      return;
    }
    setCountering(false);
    router.refresh();
  }

  // An accepted offer lets the buyer check out at the agreed price.
  if (accepted && role === "buyer") {
    return (
      <a
        href={`/checkout/${listingId}?offer=${offerId}`}
        className="inline-flex rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
      >
        Buy at agreed price
      </a>
    );
  }

  const nothing = !canAccept && !canRespond && !canWithdraw;
  if (nothing) {
    return <span className="text-xs text-ink-soft capitalize">{status.toLowerCase()}</span>;
  }

  if (countering) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={counterAmount}
          onChange={(e) => setCounterAmount(e.target.value)}
          placeholder="0.00"
          className="w-24 rounded-lg border border-brand-200 px-2 py-1 text-xs text-ink outline-none focus:border-brand-500"
        />
        <button
          onClick={() => act("counter", counterAmount)}
          disabled={busy !== null || Number(counterAmount) <= 0}
          className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy === "counter" ? "…" : "Send counter"}
        </button>
        <button
          onClick={() => setCountering(false)}
          className="text-xs font-medium text-ink-soft hover:text-brand-700"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAccept && (
        <button
          onClick={() => act("accept")}
          disabled={busy !== null}
          className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy === "accept" ? "…" : "Accept"}
        </button>
      )}
      {canRespond && (
        <button
          onClick={() => setCountering(true)}
          disabled={busy !== null}
          className="rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-brand-50 disabled:opacity-50"
        >
          Counter
        </button>
      )}
      {canRespond && (
        <button
          onClick={() => act("decline")}
          disabled={busy !== null}
          className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
        >
          {busy === "decline" ? "…" : "Decline"}
        </button>
      )}
      {canWithdraw && (
        <button
          onClick={() => act("withdraw")}
          disabled={busy !== null}
          className="rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-brand-50 disabled:opacity-50"
        >
          {busy === "withdraw" ? "…" : "Withdraw"}
        </button>
      )}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
