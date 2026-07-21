"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Bundle checkout form (SOW §09). Posts the ship-to address + a single combined
// shipping price to /api/bundles/[id]/checkout, which creates one escrow Order
// per item atomically. Item prices are server-authoritative; only shipping and
// address come from here.

type Props = {
  bundleId: string;
  itemsSubtotal: number;
  protectionSubtotal: number;
  currency: string;
  country: string;
};

const inputClass =
  "w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// INTERIM: single flat combined shipping until the carrier-aggregator rate fetch
// (Phase 1.9) lands — the whole bundle ships as one parcel, charged once.
const FLAT_BUNDLE_SHIPPING = 4.99;

export function BundleCheckoutForm({
  bundleId,
  itemsSubtotal,
  protectionSubtotal,
  currency,
  country,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total =
    Math.round((itemsSubtotal + FLAT_BUNDLE_SHIPPING + protectionSubtotal) * 100) / 100;

  async function onSubmit(form: FormData) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bundles/${bundleId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingPrice: FLAT_BUNDLE_SHIPPING,
          address: {
            line1: form.get("line1"),
            line2: form.get("line2"),
            city: form.get("city"),
            postalCode: form.get("postalCode"),
            country: form.get("country"),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout failed");
        setSubmitting(false);
        return;
      }
      router.push(`/orders?bundle=${bundleId}`);
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">
          Shipping address
        </h2>
        <input name="line1" placeholder="Address line 1" required className={inputClass} />
        <input name="line2" placeholder="Address line 2 (optional)" className={inputClass} />
        <div className="grid grid-cols-2 gap-3">
          <input name="city" placeholder="City" required className={inputClass} />
          <input name="postalCode" placeholder="Postal code" required className={inputClass} />
        </div>
        <input
          name="country"
          placeholder="Country (2-letter)"
          defaultValue={country}
          maxLength={2}
          required
          className={inputClass}
        />
      </div>

      <div className="space-y-2 rounded-2xl border border-brand-100 bg-white p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-soft">Items subtotal</span>
          <span>{fmt(itemsSubtotal, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-soft">Combined shipping (once)</span>
          <span>{fmt(FLAT_BUNDLE_SHIPPING, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-soft">Buyer protection</span>
          <span>{fmt(protectionSubtotal, currency)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-brand-100 pt-2 font-semibold">
          <span>Total</span>
          <span>{fmt(total, currency)}</span>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Processing…" : `Pay ${fmt(total, currency)}`}
      </button>
      <p className="text-center text-xs text-ink-soft">
        Each item is held in escrow until you confirm delivery.
      </p>
    </form>
  );
}
