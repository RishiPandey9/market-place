"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Seller action: mark the order shipped. The ship API generates a label
// (sandbox until the carrier integration is live) and moves PAID → SHIPPED.
export function ShipOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ship() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/ship`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not mark shipped");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={ship}
        disabled={busy}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Generating label…" : "Mark as shipped"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
