import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ListingCard } from "@/components/listing/ListingCard";

// Home feed (Phase 1 — documented /feed). Post-login landing page: the latest
// active listings from the community. Header/nav come from the (dashboard)
// layout. Signed-out visitors are sent to the public landing page.
export default async function FeedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/feed");
  }

  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 24,
    include: { category: { select: { name: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Your feed
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            The latest items from sellers in the community.
          </p>
        </div>
        <Link
          href="/listings/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Sell an item
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <p className="text-sm text-gray-500">
            No listings yet. Be the first to{" "}
            <Link href="/listings/new" className="font-medium text-gray-900 underline">
              list an item
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={{
                id: listing.id,
                title: listing.title,
                price: listing.price.toString(),
                currency: listing.currency,
                images: listing.images,
                status: listing.status,
                brand: listing.brand,
                size: listing.size,
                condition: listing.condition,
                category: listing.category,
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
