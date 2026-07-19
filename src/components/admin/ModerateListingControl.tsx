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
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy === "approve" ? "…" : "Approve"}
        </button>
      )}
      {canApprove && (
        <button
          onClick={() => act("reject")}
          disabled={busy !== null}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy === "reject" ? "…" : "Reject"}
        </button>
      )}
      {canHide && (
        <button
          onClick={() => act("hide")}
          disabled={busy !== null}
          className="rounded-md bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy === "hide" ? "…" : "Hide"}
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
