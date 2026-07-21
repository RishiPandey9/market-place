import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckoutForm } from "@/components/order/CheckoutForm";

export const metadata = { title: "Checkout" };

// NOTE: /checkout/[listingId] is NOT in the documented page map in
// technical-foundation.md. Added here to host the checkout form (Phase 1.7),
// since the doc defines POST /api/orders and the order detail page but no page
// to initiate checkout. Flagged as an addition per CLAUDE.md.
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ offer?: string }>;
}) {
  const { listingId } = await params;
  const { offer: offerId } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/checkout/${listingId}`);
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      price: true,
      currency: true,
      country: true,
      status: true,
      sellerId: true,
      images: true,
    },
  });

  if (!listing || listing.status !== "ACTIVE") notFound();
  if (listing.sellerId === session.user.id) {
    // Sellers can't buy their own item.
    redirect(`/listing/${listing.id}`);
  }

  // If an accepted-offer id is supplied, price the checkout at the agreed
  // amount. The offer must belong to this buyer + listing and be ACCEPTED;
  // otherwise we ignore it and fall back to list price.
  let itemPrice = listing.price.toString();
  let agreedOfferId: string | undefined;
  if (offerId) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, buyerId: true, listingId: true, status: true, amount: true },
    });
    if (
      offer &&
      offer.buyerId === session.user.id &&
      offer.listingId === listing.id &&
      offer.status === "ACCEPTED"
    ) {
      itemPrice = offer.amount.toString();
      agreedOfferId = offer.id;
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">
        Checkout
      </h1>
      <p className="mb-6 text-sm text-ink-soft">{listing.title}</p>

      {agreedOfferId && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          Buying at your accepted offer price.
        </p>
      )}

      <CheckoutForm
        listingId={listing.id}
        offerId={agreedOfferId}
        itemPrice={itemPrice}
        currency={listing.currency}
        country={listing.country}
      />
    </main>
  );
}
