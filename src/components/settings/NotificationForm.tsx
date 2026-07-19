"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Prefs = {
  emailOrders: boolean;
  emailMessages: boolean;
  emailMarketing: boolean;
  pushOrders: boolean;
  pushMessages: boolean;
  pushMarketing: boolean;
};

const ROWS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: "emailOrders", label: "Order updates (email)", hint: "Payments, shipping, delivery, disputes." },
  { key: "emailMessages", label: "New messages (email)", hint: "When a buyer or seller messages you." },
  { key: "emailMarketing", label: "Promotions (email)", hint: "Offers and marketing. Off by default." },
  { key: "pushOrders", label: "Order updates (push)", hint: "Order status changes in-app." },
  { key: "pushMessages", label: "New messages (push)", hint: "New chat messages in-app." },
  { key: "pushMarketing", label: "Promotions (push)", hint: "Offers and marketing. Off by default." },
];

// Notification preferences form (Phase 3.2). Toggles per-channel opt-ins via
// PATCH /api/settings/notifications, which upserts the row. Email/push delivery
// wiring (SendGrid/Twilio) is deferred — these preferences are stored now so the
// delivery layer can honor them once it lands.
export function NotificationForm({ initial }: { initial: Prefs }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof Prefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  }

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save preferences.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {ROWS.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{row.label}</p>
              <p className="text-xs text-gray-500">{row.hint}</p>
            </div>
            <input
              type="checkbox"
              checked={prefs[row.key]}
              onChange={() => toggle(row.key)}
              className="h-4 w-4 shrink-0"
            />
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Preferences saved.</p>}

      <button
        onClick={save}
        disabled={loading}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save preferences"}
      </button>
    </div>
  );
}
