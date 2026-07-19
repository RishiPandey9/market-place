"use client";

import { useState } from "react";

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";

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
      <div className="max-w-md rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
        <p className="font-medium">Password changed.</p>
        <p className="mt-1 text-green-700">
          Your new password is active. Use it next time you sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="max-w-md space-y-5">
      <div>
        <label className="text-sm font-medium text-gray-700">Current password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          className={inputClass}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          className={inputClass}
        />
        {fieldErrors.newPassword?.[0] && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.newPassword[0]}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          At least 8 characters, with upper, lower, and a number.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={loading || !currentPassword || !newPassword}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
