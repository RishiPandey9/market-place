"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Owner-only delete (hide) button for a listing detail page.
export function DeleteListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function hide() {
    if (!confirm("Hide this listing? Buyers will no longer see it.")) return;
    setBusy(true);
    const res = await fetch(`/api/listings/${listingId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.push("/my-listings");
      router.refresh();
    } else {
      alert("Could not hide the listing.");
    }
  }

  return (
    <button
      type="button"
      onClick={hide}
      disabled={busy}
      className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? "Hiding…" : "Hide listing"}
    </button>
  );
}
