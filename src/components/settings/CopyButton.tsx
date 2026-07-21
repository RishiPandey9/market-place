"use client";

import { useState } from "react";

// Copy-to-clipboard button for the referral link. Small client island inside the
// otherwise-server referrals page.
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context) — no-op; the value is visible.
    }
  }

  return (
    <button
      onClick={copy}
      className="shrink-0 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
