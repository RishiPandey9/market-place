"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  listingId: string;
  itemPrice: string;
  currency: string;
  country: string;
};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// INTERIM shipping: the carrier-aggregator rate fetch (Phase 1.9) is not wired
// yet, so we offer a single flat "Standard" option. This is clearly a
// placeholder to be replaced by live rates before launch.
const FLAT_SHIPPING = 3.99;

export function CheckoutForm({ listingId, itemPrice, currency, country }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const item = Number(itemPrice);
  const protectionFee = Math.round((item * 0.05 + 0.7) * 100) / 100;
  const total = Math.round((item + FLAT_SHIPPING + protectionFee) * 100) / 100;

  async function onSubmit(form: FormData) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          shippingPrice: FLAT_SHIPPING,
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
      router.push(`/orders/${data.orderId}?created=1`);
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-400">
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

      <div className="space-y-2 rounded-lg border border-gray-200 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Item</span>
          <span>{fmt(item, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Shipping (Standard)</span>
          <span>{fmt(FLAT_SHIPPING, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Buyer protection</span>
          <span>{fmt(protectionFee, currency)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 font-semibold">
          <span>Total</span>
          <span>{fmt(total, currency)}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {submitting ? "Processing…" : `Pay ${fmt(total, currency)}`}
      </button>
      <p className="text-center text-xs text-gray-400">
        Your payment is held in escrow until you confirm delivery.
      </p>
    </form>
  );
}
