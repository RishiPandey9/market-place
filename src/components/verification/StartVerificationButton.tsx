"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Starts a Level 3 identity-verification session. In sandbox mode there is no
// real provider redirect, so we surface the session details and explain that the
// approval arrives via the provider webhook. In live mode this would redirect
// the user to the provider's hosted flow (kyc.redirectUrl).
export function StartVerificationButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<
    { redirectUrl: string; providerRefId: string; sandbox: boolean } | null
  >(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/verification", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start verification.");
        return;
      }
      setSession(data);
      if (!data.sandbox && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (session?.sandbox) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">Sandbox verification started</p>
        <p className="mt-1">
          No live KYC provider is configured, so no real ID check runs. Session
          ref <code className="font-mono">{session.providerRefId}</code>. In
          production you&apos;d complete the provider&apos;s flow; approval then
          arrives via the KYC webhook and upgrades you to Level 3.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={start}
        disabled={loading}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "Starting…" : "Verify my identity"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
