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
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;

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

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">
        Checkout
      </h1>
      <p className="mb-6 text-sm text-ink-soft">{listing.title}</p>

      <CheckoutForm
        listingId={listing.id}
        itemPrice={listing.price.toString()}
        currency={listing.currency}
        country={listing.country}
      />
    </main>
  );
}
