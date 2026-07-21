"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Buyer action: confirm delivery → releases escrow to the seller's wallet.
export function ConfirmDeliveryButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!window.confirm("Confirm you received this item? This releases payment to the seller.")) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/confirm`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not confirm");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={confirm}
        disabled={busy}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Confirming…" : "Confirm delivery"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
