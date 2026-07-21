"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BankAccount = {
  id: string;
  label: string | null;
  holderName: string;
  country: string;
  currency: string;
  last4: string;
  verified: boolean;
  isDefault: boolean;
};

// Payout bank accounts manager (SOW §05/§08). The form NEVER collects a full
// account number — only the account-holder name, country, currency, and the
// last 4 digits for display. In production the full account is tokenized by the
// payment provider (Stripe) and only its token is stored server-side.
export function BankAccountsManager({
  initial,
}: {
  initial: BankAccount[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<BankAccount[]>(initial);
  const [form, setForm] = useState({
    label: "",
    holderName: "",
    country: "GB",
    currency: "GBP",
    last4: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add account");
        return;
      }
      setAccounts((a) => [data.bankAccount, ...a.map((x) => ({ ...x }))]);
      setForm({ label: "", holderName: "", country: "GB", currency: "GBP", last4: "" });
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
      await fetch(`/api/settings/bank-accounts/${id}`, { method: "DELETE" });
      setAccounts((a) => a.filter((x) => x.id !== id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/settings/bank-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      setAccounts((a) => a.map((x) => ({ ...x, isDefault: x.id === id })));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <ul className="space-y-3">
        {accounts.length === 0 && (
          <li className="rounded-2xl border border-dashed border-brand-200 p-6 text-center text-sm text-ink-soft">
            No payout accounts yet. Add one below to withdraw your balance.
          </li>
        )}
        {accounts.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-2xl border border-brand-100 p-4"
          >
            <div>
              <p className="text-sm font-medium text-ink">
                {a.label || a.holderName}
                {a.isDefault && (
                  <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                    Default
                  </span>
                )}
                {a.verified ? (
                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Verified
                  </span>
                ) : (
                  <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Pending
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {a.holderName} · {a.country} · {a.currency} · ••••{a.last4}
              </p>
            </div>
            <div className="flex gap-2">
              {!a.isDefault && (
                <button
                  type="button"
                  onClick={() => makeDefault(a.id)}
                  disabled={busy}
                  className="text-xs text-ink-soft hover:text-ink disabled:opacity-50"
                >
                  Set default
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(a.id)}
                disabled={busy}
                className="text-xs text-rose-600 hover:text-rose-700 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="space-y-4 rounded-2xl border border-brand-100 p-5">
        <p className="text-sm font-semibold text-ink">Add payout account</p>
        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-ink-soft">Nickname (optional)</span>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              placeholder="My bank"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-soft">Account holder name</span>
            <input
              required
              value={form.holderName}
              onChange={(e) => setForm({ ...form, holderName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-soft">Country</span>
            <input
              required
              maxLength={2}
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
              className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm uppercase text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-soft">Currency</span>
            <input
              required
              maxLength={3}
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm uppercase text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-soft">Last 4 digits</span>
            <input
              required
              inputMode="numeric"
              maxLength={4}
              value={form.last4}
              onChange={(e) =>
                setForm({ ...form, last4: e.target.value.replace(/\D/g, "").slice(0, 4) })
              }
              className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              placeholder="1234"
            />
          </label>
        </div>
        <p className="text-xs text-ink-soft">
          For your security we never store your full account number — only the
          last 4 digits are kept for display. The full account is handled by our
          regulated payment provider.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add account"}
        </button>
      </form>
    </div>
  );
}
