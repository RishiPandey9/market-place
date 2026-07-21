"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  ticketId: string;
  status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
};

// Agent-side controls for a support ticket (Phase 3.3): reply, and status
// actions (resolve / close / reopen) gated by the ticket state machine on the
// server. Posts to the RBAC-gated admin API.
export function AdminTicketControls({ ticketId, status }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBody("");
        router.refresh();
        return;
      }
      setError(data.error ?? "Could not send reply.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(target: Props["status"]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.refresh();
        return;
      }
      setError(data.error ?? "Could not change status.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const isClosed = status === "CLOSED";

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!isClosed && (
        <form onSubmit={reply} className="space-y-3">
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Reply to the customer…"
            className="block w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            type="submit"
            disabled={busy || !body.trim()}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Working…" : "Send reply"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2 border-t border-brand-100 pt-4">
        {(status === "OPEN" || status === "PENDING") && (
          <button
            onClick={() => setStatus("RESOLVED")}
            disabled={busy}
            className="rounded-xl border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
          >
            Mark resolved
          </button>
        )}
        {!isClosed && (
          <button
            onClick={() => setStatus("CLOSED")}
            disabled={busy}
            className="rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-brand-50 disabled:opacity-50"
          >
            Close
          </button>
        )}
        {(status === "RESOLVED" || status === "CLOSED") && (
          <button
            onClick={() => setStatus("OPEN")}
            disabled={busy}
            className="rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-brand-50 disabled:opacity-50"
          >
            Reopen
          </button>
        )}
      </div>
    </div>
  );
}
