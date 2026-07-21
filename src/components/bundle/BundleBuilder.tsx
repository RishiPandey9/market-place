"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

// Bundle builder (SOW §09). Renders a seller's active listings with a
// select-to-bundle affordance. The buyer ticks 2–20 items and creates a draft
// bundle; on success we route to the bundle checkout page. Only shown to a
// signed-in viewer who is not the seller.

export type BuilderListing = {
  id: string;
  title: string;
  price: string;
  currency: string;
  image: string | null;
  brand: string | null;
  size: string | null;
};

const MIN = 2;
const MAX = 20;

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function BundleBuilder({ listings }: { listings: BuilderListing[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = listings[0]?.currency ?? "GBP";

  const subtotal = useMemo(() => {
    return listings
      .filter((l) => selected.has(l.id))
      .reduce((sum, l) => sum + Number(l.price), 0);
  }, [listings, selected]);

  function toggle(id: string) {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX) return prev;
        next.add(id);
      }
      return next;
    });
  }

  async function createBundle() {
    if (selected.size < MIN) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create bundle");
        setSubmitting(false);
        return;
      }
      router.push(`/bundles/${data.bundleId}`);
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  const count = selected.size;
  const canCreate = count >= MIN && count <= MAX;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Tick {MIN}+ items to bundle them and pay shipping once.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {listings.map((l) => {
          const isSelected = selected.has(l.id);
          return (
            <div
              key={l.id}
              className={`overflow-hidden rounded-2xl border bg-white transition ${
                isSelected ? "border-brand-500 ring-2 ring-brand-500/30" : "border-gray-100"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(l.id)}
                className="block w-full text-left"
                aria-pressed={isSelected}
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-gray-100">
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image} alt={l.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      No image
                    </div>
                  )}
                  <span
                    className={`absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                      isSelected ? "bg-brand-600 text-white" : "bg-white/90 text-gray-400"
                    }`}
                  >
                    {isSelected ? "✓" : "+"}
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-ink">{l.title}</p>
                  <p className="mt-1 text-base font-bold text-ink">
                    {formatPrice(Number(l.price), l.currency)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-soft">
                    {[l.brand, l.size].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </button>
              <Link
                href={`/listing/${l.id}`}
                className="block border-t border-gray-100 px-3 py-1.5 text-center text-xs font-medium text-brand-700 hover:bg-brand-50"
              >
                View item
              </Link>
            </div>
          );
        })}
      </div>

      {/* Sticky bundle bar */}
      {count > 0 && (
        <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <div className="text-sm">
            <span className="font-semibold text-ink">
              {count} item{count === 1 ? "" : "s"} selected
            </span>
            <span className="ml-2 text-ink-soft">
              Items subtotal {formatPrice(subtotal, currency)}
            </span>
            {error && <p className="mt-1 text-rose-600">{error}</p>}
            {!canCreate && count < MIN && (
              <p className="mt-1 text-ink-soft">Select at least {MIN} items.</p>
            )}
          </div>
          <button
            type="button"
            onClick={createBundle}
            disabled={!canCreate || submitting}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Bundle these items"}
          </button>
        </div>
      )}
    </div>
  );
}
