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
    <div className="max-w-lg space-y-3 rounded-lg border border-gray-200 bg-white p-5">
      <input
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="User ID"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
      />
      <div className="flex gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
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
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="assign">Assign</option>
          <option value="revoke">Revoke</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      <button
        onClick={submit}
        disabled={busy || !userId.trim()}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Apply"}
      </button>
    </div>
  );
}
