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
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => resolve("refund")}
          disabled={busy !== null}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy === "refund" ? "Refunding…" : "Refund buyer"}
        </button>
        <button
          onClick={() => resolve("release")}
          disabled={busy !== null}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy === "release" ? "Releasing…" : "Release to seller"}
        </button>
      </div>
    </div>
  );
}
