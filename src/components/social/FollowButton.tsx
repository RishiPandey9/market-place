"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Follow / unfollow toggle for a seller profile (SOW §04). Optimistic: flips
// state immediately, reverts on error. Renders nothing for the seller's own
// profile or logged-out visitors (the server decides whether to mount it).
export function FollowButton({
  sellerId,
  initialFollowing,
  initialCount,
}: {
  sellerId: string;
  initialFollowing: boolean;
  initialCount: number;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !following;
    // Optimistic update.
    setFollowing(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId, follow: next }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as { followerCount?: number };
      if (typeof data.followerCount === "number") setCount(data.followerCount);
      router.refresh();
    } catch {
      // Revert on failure.
      setFollowing(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={
        following
          ? "rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          : "rounded-xl border border-brand-200 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-brand-50 disabled:opacity-60"
      }
      aria-pressed={following}
    >
      {following ? "Following" : "Follow"}
      <span className="ml-2 text-xs opacity-70">{count}</span>
    </button>
  );
}
