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
      <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
        Thanks for your feedback.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-medium text-gray-900">Leave a rating</h2>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            className={`text-2xl ${n <= score ? "text-amber-400" : "text-gray-300"}`}
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
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit rating"}
      </button>
    </div>
  );
}
