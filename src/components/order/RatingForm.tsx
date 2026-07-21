"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Leave a rating after a completed order. Shown to both parties once RELEASED.
export function RatingForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, score, comment }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not submit rating");
      setBusy(false);
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
        Thanks for your feedback.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-brand-100 bg-white p-4">
      <h2 className="text-sm font-medium text-ink">Leave a rating</h2>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            className={`text-2xl ${n <= score ? "text-amber-400" : "text-ink-soft"}`}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Add a comment (optional)…"
        className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit rating"}
      </button>
    </div>
  );
}
