import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ListingCard } from "@/components/listing/ListingCard";

export const metadata = { title: "My listings" };

export default async function MyListingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/my-listings");
  }

  const listings = await prisma.listing.findMany({
    where: { sellerId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { category: { select: { name: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          My listings
        </h1>
        <Link
          href="/listings/new"
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 py-16 text-center">
          <p className="text-sm text-ink-soft">You have no listings yet.</p>
          <Link
            href="/listings/new"
            className="mt-3 inline-block text-sm font-medium text-brand-700 underline hover:text-brand-800"
          >
            Create your first listing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={{
                ...listing,
                price: listing.price.toString(),
              }}
              showStatus
            />
          ))}
        </div>
      )}
    </main>
  );
}
