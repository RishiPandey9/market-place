import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DeleteListingButton } from "@/components/listing/DeleteListingButton";

function formatPrice(price: string, currency: string): string {
  const amount = Number(price);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      seller: { select: { id: true, verificationLevel: true } },
    },
  });

  if (!listing) notFound();

  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.id === listing.sellerId;

  // Non-owners can only see live listings.
  if (listing.status !== "ACTIVE" && !isOwner) notFound();

  const details = [
    ["Brand", listing.brand],
    ["Size", listing.size],
    ["Condition", listing.condition],
    ["Color", listing.color],
    ["Category", listing.category?.name],
    ["Parcel size", listing.parcelSize],
  ].filter(([, v]) => Boolean(v));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
            {listing.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.images[0]}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                No image
              </div>
            )}
          </div>
          {listing.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {listing.images.slice(1).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${url}-${i}`}
                  src={url}
                  alt=""
                  className="aspect-square w-full rounded-md border border-gray-200 object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div>
          {isOwner && listing.status !== "ACTIVE" && (
            <span className="mb-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {listing.status.replace(/_/g, " ").toLowerCase()}
            </span>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {listing.title}
          </h1>
          <p className="mt-2 text-xl font-semibold text-gray-900">
            {formatPrice(listing.price.toString(), listing.currency)}
          </p>

          <p className="mt-4 whitespace-pre-line text-sm text-gray-600">
            {listing.description}
          </p>

          {details.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {details.map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-gray-400">{label}</dt>
                  <dd className="text-gray-900">{value as string}</dd>
                </div>
              ))}
            </dl>
          )}

          <p className="mt-6 text-xs text-gray-400">
            Seller:{" "}
            <Link
              href={`/seller/${listing.seller.id}`}
              className="text-gray-600 underline hover:text-gray-900"
            >
              Seller {listing.seller.id.slice(-6).toUpperCase()}
            </Link>
          </p>

          {isOwner && (
            <div className="mt-8 flex gap-3 border-t border-gray-100 pt-6">
              <Link
                href={`/listings/${listing.id}/edit`}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Edit
              </Link>
              {listing.status !== "HIDDEN" && (
                <DeleteListingButton listingId={listing.id} />
              )}
            </div>
          )}

          {!isOwner && listing.status === "ACTIVE" && (
            <div className="mt-8 border-t border-gray-100 pt-6">
              {session?.user ? (
                <Link
                  href={`/checkout/${listing.id}`}
                  className="inline-block rounded-md bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Buy now
                </Link>
              ) : (
                <Link
                  href={`/login?callbackUrl=/checkout/${listing.id}`}
                  className="inline-block rounded-md bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Log in to buy
                </Link>
              )}
              <p className="mt-2 text-xs text-gray-400">
                Protected by escrow until you confirm delivery.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
