"use client";

import { useState } from "react";

const inputClass =
  "mt-1 block w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

// Password change form (Phase 3.2). Posts to /api/settings/password, which
// verifies the current password with bcrypt before setting the new hash. No
// password value is ever stored in component state longer than the request.
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not change your password.");
        if (data.issues) setFieldErrors(data.issues);
        return;
      }
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
        <p className="font-medium">Password changed.</p>
        <p className="mt-1 text-emerald-700">
          Your new password is active. Use it next time you sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="max-w-md space-y-5">
      <div>
        <label className="text-sm font-medium text-ink">Current password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          className={inputClass}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-ink">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          className={inputClass}
        />
        {fieldErrors.newPassword?.[0] && (
          <p className="mt-1 text-xs text-rose-600">{fieldErrors.newPassword[0]}</p>
        )}
        <p className="mt-1 text-xs text-ink-soft">
          At least 8 characters, with upper, lower, and a number.
        </p>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        onClick={submit}
        disabled={loading || !currentPassword || !newPassword}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
