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
  ACTIVE: "bg-green-100 text-green-700",
  RESERVED: "bg-blue-100 text-blue-700",
  SOLD: "bg-gray-900 text-white",
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
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        {cover ? (
          // Interim: images are plain CDN/remote URLs until /api/upload
          // (Cloudinary) lands. Using <img> avoids next/image remote-host config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={listing.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
            No image
          </div>
        )}

        {showStatus && (
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${
              STATUS_STYLES[listing.status] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {listing.status.replace(/_/g, " ").toLowerCase()}
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="truncate text-sm font-medium text-gray-900">
          {listing.title}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-gray-900">
          {formatPrice(listing.price, listing.currency)}
        </p>
        <p className="mt-1 truncate text-xs text-gray-500">
          {[listing.brand, listing.size, listing.category?.name]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
