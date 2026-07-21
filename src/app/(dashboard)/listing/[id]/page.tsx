import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DeleteListingButton } from "@/components/listing/DeleteListingButton";
import { ListingGallery } from "@/components/listing/ListingGallery";
import { TrustBadges } from "@/components/trust/TrustBadges";

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
      seller: {
        select: {
          id: true,
          verificationLevel: true,
          emailVerified: true,
          phoneVerified: true,
          stripeAccountId: true,
        },
      },
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

  const sellerLabel = `Seller ${listing.seller.id.slice(-6).toUpperCase()}`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-ink-soft">
        <Link href="/" className="hover:text-brand-700">
          Home
        </Link>
        <span>/</span>
        {listing.category?.name && (
          <>
            <span>{listing.category.name}</span>
            <span>/</span>
          </>
        )}
        <span className="truncate text-ink">{listing.title}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <ListingGallery images={listing.images} title={listing.title} />

        <div className="md:sticky md:top-28 md:self-start">
          {isOwner && listing.status !== "ACTIVE" && (
            <span className="mb-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium capitalize text-amber-700">
              {listing.status.replace(/_/g, " ").toLowerCase()}
            </span>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {listing.title}
          </h1>
          <p className="mt-2 text-3xl font-extrabold text-ink">
            {formatPrice(listing.price.toString(), listing.currency)}
          </p>
          {listing.condition && (
            <p className="mt-1 text-sm text-ink-soft">
              Condition: <span className="font-medium text-ink">{listing.condition}</span>
            </p>
          )}

          {/* Buy / owner actions */}
          {isOwner ? (
            <div className="mt-6 flex gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <Link
                href={`/listings/${listing.id}/edit`}
                className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Edit listing
              </Link>
              {listing.status !== "HIDDEN" && (
                <DeleteListingButton listingId={listing.id} />
              )}
            </div>
          ) : (
            listing.status === "ACTIVE" && (
              <div className="mt-6 space-y-3">
                {session?.user ? (
                  <Link
                    href={`/checkout/${listing.id}`}
                    className="block rounded-full bg-brand-600 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                  >
                    Buy now
                  </Link>
                ) : (
                  <Link
                    href={`/login?callbackUrl=/checkout/${listing.id}`}
                    className="block rounded-full bg-brand-600 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                  >
                    Log in to buy
                  </Link>
                )}
                <p className="flex items-center justify-center gap-1.5 text-xs text-ink-soft">
                  <svg className="h-3.5 w-3.5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" />
                  </svg>
                  Protected by escrow until you confirm delivery
                </p>
              </div>
            )
          )}

          {/* Seller card */}
          <div className="mt-6 rounded-2xl border border-gray-100 p-4">
            <Link href={`/seller/${listing.seller.id}`} className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
                {listing.seller.id.slice(-2).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {sellerLabel}
                </span>
                <span className="text-xs text-brand-700 hover:underline">
                  View profile
                </span>
              </span>
            </Link>
            <TrustBadges
              className="mt-3"
              signals={{
                emailVerified: listing.seller.emailVerified,
                phoneVerified: listing.seller.phoneVerified,
                verificationLevel: listing.seller.verificationLevel,
                stripeAccountId: listing.seller.stripeAccountId,
              }}
            />
          </div>

          {/* Description */}
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-ink">Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">
              {listing.description}
            </p>
          </div>

          {/* Details */}
          {details.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-6 text-sm">
              {details.map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-gray-400">{label}</dt>
                  <dd className="mt-0.5 font-medium text-ink">{value as string}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </main>
  );
}
