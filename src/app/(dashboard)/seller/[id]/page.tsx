import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ListingCard } from "@/components/listing/ListingCard";
import { TrustBadges } from "@/components/trust/TrustBadges";
import { FollowButton } from "@/components/social/FollowButton";

// Public seller profile (Phase 1.10 / doc page inventory: /seller/[id]).
// Shows the seller's rating summary, their reviews, and their active listings.
// No private data (email, addresses, wallet) is ever exposed here.

// A light, privacy-preserving handle derived from the account id — the User
// model has no display-name field, so we avoid leaking the email address.
function handle(id: string) {
  return `Seller ${id.slice(-6).toUpperCase()}`;
}

function Stars({ score }: { score: number }) {
  return (
    <span className="text-amber-400" aria-label={`${score} out of 5`}>
      {"★".repeat(score)}
      <span className="text-gray-300">{"★".repeat(5 - score)}</span>
    </span>
  );
}

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const seller = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      createdAt: true,
      country: true,
      emailVerified: true,
      phoneVerified: true,
      verificationLevel: true,
      stripeAccountId: true,
    },
  });
  if (!seller) notFound();

  const [ratings, listings, agg] = await Promise.all([
    prisma.rating.findMany({
      where: { targetId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, score: true, comment: true, createdAt: true, authorId: true },
    }),
    prisma.listing.findMany({
      where: { sellerId: id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        id: true,
        title: true,
        price: true,
        currency: true,
        images: true,
        brand: true,
        size: true,
      },
    }),
    prisma.rating.aggregate({
      where: { targetId: id },
      _avg: { score: true },
      _count: { score: true },
    }),
  ]);

  const avg = agg._avg.score;
  const count = agg._count.score;

  // Follow state (SOW §04). The viewer can follow any seller except themselves.
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;
  const isSelf = viewerId === seller.id;
  const [followerCount, viewerFollows] = await Promise.all([
    prisma.follow.count({ where: { followingId: seller.id } }),
    viewerId && !isSelf
      ? prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewerId,
              followingId: seller.id,
            },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <header className="mb-8 border-b border-brand-100 pb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {handle(seller.id)}
          </h1>
          {viewerId && !isSelf && (
            <FollowButton
              sellerId={seller.id}
              initialFollowing={Boolean(viewerFollows)}
              initialCount={followerCount}
            />
          )}
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm text-ink-soft">
          {count > 0 ? (
            <>
              <Stars score={Math.round(avg ?? 0)} />
              <span className="font-medium text-ink">
                {(avg ?? 0).toFixed(1)}
              </span>
              <span className="text-ink-soft">
                ({count} review{count === 1 ? "" : "s"})
              </span>
            </>
          ) : (
            <span className="text-ink-soft">No reviews yet</span>
          )}
          {seller.country && (
            <span className="text-ink-soft">· {seller.country}</span>
          )}
        </div>
        <TrustBadges
          className="mt-3"
          signals={{
            emailVerified: seller.emailVerified,
            phoneVerified: seller.phoneVerified,
            verificationLevel: seller.verificationLevel,
            stripeAccountId: seller.stripeAccountId,
          }}
        />
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-medium text-ink">
          Listings ({listings.length})
        </h2>
        {listings.length === 0 ? (
          <p className="text-sm text-ink-soft">No active listings.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
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
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-ink">Reviews</h2>
        {ratings.length === 0 ? (
          <p className="text-sm text-ink-soft">No reviews yet.</p>
        ) : (
          <ul className="space-y-4">
            {ratings.map((r) => (
              <li key={r.id} className="rounded-2xl border border-brand-100 p-4">
                <div className="flex items-center justify-between">
                  <Stars score={r.score} />
                  <time className="text-xs text-ink-soft">
                    {r.createdAt.toLocaleDateString()}
                  </time>
                </div>
                <p className="mt-1 text-xs text-ink-soft">{handle(r.authorId)}</p>
                {r.comment && (
                  <p className="mt-2 text-sm text-ink-soft">{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
