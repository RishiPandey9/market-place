import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ListingCard } from "@/components/listing/ListingCard";

export const metadata = { title: "Following" };

// Following feed (SOW §02 "activity feed" / §04 follow-seller). Shows the newest
// active listings from sellers the signed-in user follows.
export default async function FollowingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/following");
  }

  const follows = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followingId: true },
  });
  const sellerIds = follows.map((f) => f.followingId);

  const listings = sellerIds.length
    ? await prisma.listing.findMany({
        where: { sellerId: { in: sellerIds }, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 48,
        select: {
          id: true,
          title: true,
          price: true,
          currency: true,
          images: true,
          brand: true,
          size: true,
        },
      })
    : [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Following
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Newest items from the {sellerIds.length} seller
        {sellerIds.length === 1 ? "" : "s"} you follow.
      </p>

      {sellerIds.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-brand-200 p-8 text-center text-sm text-ink-soft">
          You don&apos;t follow anyone yet. Open a{" "}
          <Link href="/search" className="underline">
            seller&apos;s profile
          </Link>{" "}
          and tap Follow to see their new listings here.
        </div>
      ) : listings.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">
          No active listings from the sellers you follow right now.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={{
                id: l.id,
                title: l.title,
                price: l.price.toString(),
                currency: l.currency,
                images: l.images,
                status: "ACTIVE",
                brand: l.brand,
                size: l.size,
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
