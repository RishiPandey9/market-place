"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  phone: string;
  country: string;
  currency: string;
  language: string;
};

const inputClass =
  "mt-1 block w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

// Profile settings form (Phase 3.2). Edits contact + locale fields on the User
// row via PATCH /api/settings/profile. Email is shown read-only — changing it
// needs re-verification, a separate flow.
export function ProfileForm({
  email,
  initial,
}: {
  email: string;
  initial: Profile;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Profile>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  function set(key: keyof Profile, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function submit() {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save your profile.");
        if (data.issues) setFieldErrors(data.issues);
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
    <form onSubmit={(e) => e.preventDefault()} className="max-w-md space-y-5">
      <div>
        <label className="text-sm font-medium text-ink">Email</label>
        <input value={email} disabled className={`${inputClass} bg-brand-50 text-ink-soft`} />
        <p className="mt-1 text-xs text-ink-soft">
          Email changes require re-verification and aren&apos;t available here yet.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-ink">Phone</label>
        <input
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="+44 7700 900123"
          className={inputClass}
        />
        {fieldErrors.phone?.[0] && (
          <p className="mt-1 text-xs text-rose-600">{fieldErrors.phone[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-ink">Country</label>
          <input
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
            placeholder="GB"
            maxLength={2}
            className={inputClass}
          />
          {fieldErrors.country?.[0] && (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.country[0]}</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium text-ink">Currency</label>
          <input
            value={form.currency}
            onChange={(e) => set("currency", e.target.value)}
            placeholder="GBP"
            maxLength={3}
            className={inputClass}
          />
          {fieldErrors.currency?.[0] && (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.currency[0]}</p>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-ink">Language</label>
        <input
          value={form.language}
          onChange={(e) => set("language", e.target.value)}
          placeholder="en"
          maxLength={10}
          className={inputClass}
        />
        {fieldErrors.language?.[0] && (
          <p className="mt-1 text-xs text-rose-600">{fieldErrors.language[0]}</p>
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Profile saved.</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
