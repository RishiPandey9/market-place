"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PaymentMethod = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
};

// Buyer payment-methods manager (SOW §05 "Add/edit payment method").
// SECURITY (PCI-DSS, CLAUDE.md #5): this form NEVER collects a raw card number or
// CVC. In production the card is tokenized in the browser by Stripe.js (Stripe
// Elements) and only the resulting PaymentMethod id + safe display metadata
// (brand, last4, expiry) is posted here. This cut exposes the display fields so
// the flow is wired end to end; swap the manual inputs for a Stripe Elements
// card field before launch (see /src/lib/stripe.ts).
export function PaymentMethodsManager({
  initial,
}: {
  initial: PaymentMethod[];
}) {
  const router = useRouter();
  const [methods, setMethods] = useState<PaymentMethod[]>(initial);
  const [form, setForm] = useState({
    providerMethodId: "",
    brand: "",
    last4: "",
    expMonth: "",
    expYear: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerMethodId: form.providerMethodId,
          brand: form.brand || undefined,
          last4: form.last4 || undefined,
          expMonth: form.expMonth ? Number(form.expMonth) : undefined,
          expYear: form.expYear ? Number(form.expYear) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add card");
        return;
      }
      setMethods((m) => [data.paymentMethod, ...m]);
      setForm({ providerMethodId: "", brand: "", last4: "", expMonth: "", expYear: "" });
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/settings/payment-methods/${id}`, { method: "DELETE" });
      setMethods((m) => m.filter((x) => x.id !== id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/settings/payment-methods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      setMethods((m) => m.map((x) => ({ ...x, isDefault: x.id === id })));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <ul className="space-y-3">
        {methods.length === 0 && (
          <li className="rounded-2xl border border-dashed border-brand-200 p-6 text-center text-sm text-ink-soft">
            No saved cards yet. Add one below to check out faster.
          </li>
        )}
        {methods.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="text-sm font-medium text-ink">
                {(m.brand || "Card").toUpperCase()} ••••{m.last4 ?? "····"}
                {m.isDefault && (
                  <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                    Default
                  </span>
                )}
              </p>
              {m.expMonth && m.expYear && (
                <p className="mt-1 text-xs text-ink-soft">
                  Expires {String(m.expMonth).padStart(2, "0")}/{m.expYear}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              {!m.isDefault && (
                <button
                  type="button"
                  onClick={() => makeDefault(m.id)}
                  disabled={busy}
                  className="text-xs font-medium text-ink-soft hover:text-brand-700 disabled:opacity-50"
                >
                  Set default
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(m.id)}
                disabled={busy}
                className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-ink">Add a card</p>
        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-ink">Payment token (from Stripe.js)</span>
            <input
              required
              value={form.providerMethodId}
              onChange={(e) => setForm({ ...form, providerMethodId: e.target.value })}
              className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              placeholder="pm_..."
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">Brand (optional)</span>
            <input
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              placeholder="visa"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">Last 4 digits</span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={form.last4}
              onChange={(e) =>
                setForm({ ...form, last4: e.target.value.replace(/\D/g, "").slice(0, 4) })
              }
              className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              placeholder="4242"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">Exp. month</span>
            <input
              inputMode="numeric"
              maxLength={2}
              value={form.expMonth}
              onChange={(e) =>
                setForm({ ...form, expMonth: e.target.value.replace(/\D/g, "").slice(0, 2) })
              }
              className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              placeholder="12"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">Exp. year</span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={form.expYear}
              onChange={(e) =>
                setForm({ ...form, expYear: e.target.value.replace(/\D/g, "").slice(0, 4) })
              }
              className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              placeholder="2030"
            />
          </label>
        </div>
        <p className="text-xs text-ink-soft">
          For your security we never store your full card number or CVC. Your card
          is encrypted and tokenized directly by our payment provider (Stripe);
          we only keep the brand and last 4 digits for display.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Add card"}
        </button>
      </form>
    </div>
  );
}
