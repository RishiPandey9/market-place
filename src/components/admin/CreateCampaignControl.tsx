"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TYPES = [
  { value: "BANNER", label: "Banner (homepage / category)" },
  { value: "FEATURED", label: "Featured items block" },
  { value: "EMAIL", label: "Email campaign" },
] as const;

// Admin create-campaign form (Marketing section). RBAC enforced server-side by
// /api/admin/marketing (marketing.manage).
export function CreateCampaignControl() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("BANNER");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type, active }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to create campaign");
      setBusy(false);
      return;
    }
    setName("");
    setActive(false);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="max-w-lg space-y-3 rounded-2xl border border-brand-100 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">New campaign</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Campaign name (e.g. Summer Pre-Loved Sale)"
        className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      />
      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="flex-1 rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500/30"
          />
          Live now
        </label>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || name.trim().length < 2}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create campaign"}
      </button>
    </div>
  );
}
