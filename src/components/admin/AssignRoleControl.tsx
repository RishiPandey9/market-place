"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES = [
  "SUPER_ADMIN",
  "MANAGER",
  "LISTING_VERIFICATION_OFFICER",
  "KYC_REVIEWER",
  "SUPPORT_AGENT",
  "TRUST_AND_SAFETY",
  "MARKETING",
  "SEO_CONTENT",
  "FINANCE",
] as const;

// Admin role assignment / revocation form (SUPER_ADMIN only, enforced server-side).
export function AssignRoleControl() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<string>("SUPPORT_AGENT");
  const [op, setOp] = useState<"assign" | "revoke">("assign");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId.trim(), role, op }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed");
      setBusy(false);
      return;
    }
    setMsg(`${op === "assign" ? "Assigned" : "Revoked"} ${role}`);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="max-w-lg space-y-3 rounded-2xl border border-brand-100 bg-white p-5">
      <input
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="User ID"
        className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      />
      <div className="flex gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="flex-1 rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={op}
          onChange={(e) => setOp(e.target.value as "assign" | "revoke")}
          className="rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="assign">Assign</option>
          <option value="revoke">Revoke</option>
        </select>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <button
        onClick={submit}
        disabled={busy || !userId.trim()}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Apply"}
      </button>
    </div>
  );
}
