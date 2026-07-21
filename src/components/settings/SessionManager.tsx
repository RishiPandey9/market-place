"use client";

import { useEffect, useState, useCallback } from "react";

type SessionRow = {
  id: string;
  device: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

// Active-sessions manager (Phase 1.3 — session management + remote logout).
// Lists the user's non-revoked sessions and lets them sign out a single device
// or everywhere else. Revoking invalidates that device's JWT on its next
// request (see auth.ts jwt() → isSessionActive).
export function SessionManager() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/settings/sessions");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not load sessions.");
        return;
      }
      setSessions(data.sessions ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revokeOne(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/settings/sessions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not sign out that device.");
        return;
      }
      await load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function revokeOthers() {
    setBusyId("others");
    setError(null);
    try {
      const res = await fetch("/api/settings/sessions", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not sign out other devices.");
        return;
      }
      await load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-soft">Loading sessions…</p>;
  }

  const others = sessions.filter((s) => !s.current);

  return (
    <div className="max-w-lg space-y-4">
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <ul className="divide-y divide-brand-50 rounded-2xl border border-brand-100 bg-white">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-ink">
                {s.device}
                {s.current && (
                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    This device
                  </span>
                )}
              </p>
              <p className="text-xs text-ink-soft">
                {s.ip ?? "Unknown IP"} · last active{" "}
                {new Date(s.lastSeenAt).toLocaleString()}
              </p>
            </div>
            {!s.current && (
              <button
                onClick={() => revokeOne(s.id)}
                disabled={busyId === s.id}
                className="shrink-0 rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-brand-50 disabled:opacity-50"
              >
                {busyId === s.id ? "Signing out…" : "Sign out"}
              </button>
            )}
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <button
          onClick={revokeOthers}
          disabled={busyId === "others"}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busyId === "others" ? "Signing out…" : "Sign out all other devices"}
        </button>
      )}
    </div>
  );
}
