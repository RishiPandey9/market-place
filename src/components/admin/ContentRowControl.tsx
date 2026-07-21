"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Per-row content-page controls: publish / unpublish (draft) / archive, delete.
// RBAC enforced server-side by /api/admin/cms/[id] (cms.manage).
export function ContentRowControl({
  pageId,
  status,
}: {
  pageId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    setBusy(next);
    setError(null);
    const res = await fetch(`/api/admin/cms/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
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
    if (!confirm("Delete this page? This cannot be undone.")) return;
    setBusy("delete");
    setError(null);
    const res = await fetch(`/api/admin/cms/${pageId}`, { method: "DELETE" });
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
      {status !== "PUBLISHED" && (
        <button
          onClick={() => setStatus("PUBLISHED")}
          disabled={busy !== null}
          className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy === "PUBLISHED" ? "…" : "Publish"}
        </button>
      )}
      {status === "PUBLISHED" && (
        <button
          onClick={() => setStatus("DRAFT")}
          disabled={busy !== null}
          className="rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-brand-50 disabled:opacity-50"
        >
          {busy === "DRAFT" ? "…" : "Unpublish"}
        </button>
      )}
      {status !== "ARCHIVED" && (
        <button
          onClick={() => setStatus("ARCHIVED")}
          disabled={busy !== null}
          className="rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-brand-50 disabled:opacity-50"
        >
          {busy === "ARCHIVED" ? "…" : "Archive"}
        </button>
      )}
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
