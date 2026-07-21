"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Admin listing-moderation controls: approve / reject / hide.
export function ModerateListingControl({
  listingId,
  status,
}: {
  listingId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject" | "hide") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  const canApprove = status === "PENDING_REVIEW";
  const canHide = status === "ACTIVE";

  return (
    <div className="flex items-center gap-2">
      {canApprove && (
        <button
          onClick={() => act("approve")}
          disabled={busy !== null}
          className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy === "approve" ? "…" : "Approve"}
        </button>
      )}
      {canApprove && (
        <button
          onClick={() => act("reject")}
          disabled={busy !== null}
          className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
        >
          {busy === "reject" ? "…" : "Reject"}
        </button>
      )}
      {canHide && (
        <button
          onClick={() => act("hide")}
          disabled={busy !== null}
          className="rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-brand-50 disabled:opacity-50"
        >
          {busy === "hide" ? "…" : "Hide"}
        </button>
      )}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
