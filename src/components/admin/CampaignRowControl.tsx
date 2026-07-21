"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Per-row campaign controls: toggle live/paused and delete.
// RBAC enforced server-side by /api/admin/marketing/[id] (marketing.manage).
export function CampaignRowControl({
  campaignId,
  active,
}: {
  campaignId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy("toggle");
    setError(null);
    const res = await fetch(`/api/admin/marketing/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    setBusy("delete");
    setError(null);
    const res = await fetch(`/api/admin/marketing/${campaignId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={busy !== null}
        className={
          active
            ? "rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-brand-50 disabled:opacity-50"
            : "rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        }
      >
        {busy === "toggle" ? "…" : active ? "Pause" : "Go live"}
      </button>
      <button
        onClick={remove}
        disabled={busy !== null}
        className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
      >
        {busy === "delete" ? "…" : "Delete"}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
