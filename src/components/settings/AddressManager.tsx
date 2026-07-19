"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Address = {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";

const emptyForm = {
  line1: "",
  line2: "",
  city: "",
  postalCode: "",
  country: "",
  isDefault: false,
};

// Address book manager (Phase 3.2). Lists the user's saved addresses and adds
// new ones via /api/settings/addresses; set-default and delete hit the [id]
// route. Server re-validates and owns default-address bookkeeping.
export function AddressManager({ initial }: { initial: Address[] }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>(initial);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function reload() {
    const res = await fetch("/api/settings/addresses");
    if (res.ok) {
      const data = await res.json();
      setAddresses(data.addresses);
    }
    router.refresh();
  }

  async function add() {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/settings/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not add address.");
        if (data.issues) setFieldErrors(data.issues);
        return;
      }
      setForm(emptyForm);
      await reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function setDefault(id: string) {
    await fetch(`/api/settings/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await reload();
  }

  async function remove(id: string) {
    await fetch(`/api/settings/addresses/${id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <div className="space-y-8">
      <ul className="space-y-3">
        {addresses.length === 0 && (
          <li className="text-sm text-gray-500">No saved addresses yet.</li>
        )}
        {addresses.map((a) => (
          <li
            key={a.id}
            className="flex items-start justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900">
                {a.line1}
                {a.isDefault && (
                  <span className="ml-2 rounded bg-gray-900 px-1.5 py-0.5 text-xs font-medium text-white">
                    Default
                  </span>
                )}
              </p>
              {a.line2 && <p>{a.line2}</p>}
              <p>
                {a.city}, {a.postalCode}, {a.country}
              </p>
            </div>
            <div className="flex shrink-0 gap-3 text-sm">
              {!a.isDefault && (
                <button
                  onClick={() => setDefault(a.id)}
                  className="font-medium text-gray-600 hover:text-gray-900"
                >
                  Set default
                </button>
              )}
              <button
                onClick={() => remove(a.id)}
                className="font-medium text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="max-w-md rounded-lg border border-gray-200 bg-gray-50 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Add an address</h2>
        <form onSubmit={(e) => e.preventDefault()} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Address line 1</label>
            <input
              value={form.line1}
              onChange={(e) => setForm({ ...form, line1: e.target.value })}
              className={inputClass}
            />
            {fieldErrors.line1?.[0] && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.line1[0]}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Address line 2 (optional)
            </label>
            <input
              value={form.line2}
              onChange={(e) => setForm({ ...form, line2: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">City</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={inputClass}
              />
              {fieldErrors.city?.[0] && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.city[0]}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Postal code</label>
              <input
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                className={inputClass}
              />
              {fieldErrors.postalCode?.[0] && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.postalCode[0]}</p>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Country</label>
            <input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              placeholder="GB"
              maxLength={2}
              className={inputClass}
            />
            {fieldErrors.country?.[0] && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.country[0]}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            Make this my default address
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={add}
            disabled={loading}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add address"}
          </button>
        </form>
      </div>
    </div>
  );
}
