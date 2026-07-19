import { prisma } from "@/lib/db";
import { ListingCard } from "@/components/listing/ListingCard";
import { SiteHeader } from "@/components/nav/SiteHeader";

export default async function Home() {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { category: { select: { name: true } } },
  });

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <section className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Buy and sell pre-loved fashion
          </h1>
          <p className="mt-2 max-w-xl text-sm text-gray-500">
            Browse items from sellers in the community. Every purchase is
            protected by secure escrow until you confirm delivery.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-400">
            Latest listings
          </h2>

          {listings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
              <p className="text-sm text-gray-500">No listings yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={{ ...listing, price: listing.price.toString() }}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
