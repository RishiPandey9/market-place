"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Admin dispute-resolution control. Calls the money-critical resolve endpoint;
// server enforces RBAC + state machine, this is just the trigger + confirm.
export function ResolveDisputeControl({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "refund" | "release">(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(outcome: "refund" | "release") {
    if (
      !confirm(
        outcome === "refund"
          ? "Refund the buyer? The seller will NOT be paid for this order."
          : "Release escrow to the seller? The buyer will NOT be refunded.",
      )
    ) {
      return;
    }
    setBusy(outcome);
    setError(null);
    const res = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not resolve dispute");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Resolution note (optional)…"
        className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => resolve("refund")}
          disabled={busy !== null}
          className="rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
        >
          {busy === "refund" ? "Refunding…" : "Refund buyer"}
        </button>
        <button
          onClick={() => resolve("release")}
          disabled={busy !== null}
          className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy === "release" ? "Releasing…" : "Release to seller"}
        </button>
      </div>
    </div>
  );
}
