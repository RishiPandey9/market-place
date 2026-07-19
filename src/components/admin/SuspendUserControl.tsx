"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Admin user suspend / reactivate toggle.
export function SuspendUserControl({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !suspended;
    if (!confirm(next ? "Suspend this user?" : "Reactivate this user?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      <button
        onClick={toggle}
        disabled={busy}
        className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
          suspended
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
      >
        {busy ? "…" : suspended ? "Reactivate" : "Suspend"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
