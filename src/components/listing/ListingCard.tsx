import Link from "next/link";

// Shape the card needs. Kept loose so both the API listing payload and the
// server-component query can pass their rows in without a shared Prisma type.
export type ListingCardData = {
  id: string;
  title: string;
  price: string | number;
  currency: string;
  images: string[];
  status: string;
  brand?: string | null;
  size?: string | null;
  condition?: string | null;
  category?: { name: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-brand-100 text-brand-700",
  RESERVED: "bg-blue-100 text-blue-700",
  SOLD: "bg-ink text-white",
  HIDDEN: "bg-gray-100 text-gray-500",
  REJECTED: "bg-red-100 text-red-700",
};

function formatPrice(price: string | number, currency: string): string {
  const amount = typeof price === "string" ? Number(price) : price;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// showStatus: seller-facing views (my-listings) show the status badge;
// public browsing omits it.
export function ListingCard({
  listing,
  showStatus = false,
}: {
  listing: ListingCardData;
  showStatus?: boolean;
}) {
  const cover = listing.images[0];

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="card-hover group block overflow-hidden rounded-2xl border border-gray-100 bg-white"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-gray-100">
        {cover ? (
          // Interim: images are plain CDN/remote URLs until /api/upload
          // (Cloudinary) lands. Using <img> avoids next/image remote-host config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={listing.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 text-xs text-gray-400">
            No image
          </div>
        )}

        {/* Condition chip (public) */}
        {!showStatus && listing.condition && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-ink shadow-sm backdrop-blur">
            {listing.condition}
          </span>
        )}

        {/* Status badge (seller views) */}
        {showStatus && (
          <span
            className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
              STATUS_STYLES[listing.status] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {listing.status.replace(/_/g, " ").toLowerCase()}
          </span>
        )}

        {/* Like affordance — decorative on the card; the detail page owns the
            real favourite action. */}
        <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-gray-500 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 hover:text-red-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </span>
      </div>

      <div className="p-3">
        <p className="truncate text-sm font-medium text-ink">{listing.title}</p>
        <p className="mt-1 text-base font-bold text-ink">
          {formatPrice(listing.price, listing.currency)}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">
          {[listing.brand, listing.size, listing.category?.name]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
