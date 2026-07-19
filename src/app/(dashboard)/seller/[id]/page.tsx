import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { ListingCard } from "@/components/listing/ListingCard";

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
    select: { id: true, createdAt: true, country: true },
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

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {handle(seller.id)}
        </h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
          {count > 0 ? (
            <>
              <Stars score={Math.round(avg ?? 0)} />
              <span className="font-medium text-gray-900">
                {(avg ?? 0).toFixed(1)}
              </span>
              <span className="text-gray-500">
                ({count} review{count === 1 ? "" : "s"})
              </span>
            </>
          ) : (
            <span className="text-gray-500">No reviews yet</span>
          )}
          {seller.country && (
            <span className="text-gray-400">· {seller.country}</span>
          )}
        </div>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-medium text-gray-900">
          Listings ({listings.length})
        </h2>
        {listings.length === 0 ? (
          <p className="text-sm text-gray-500">No active listings.</p>
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
        <h2 className="mb-4 text-lg font-medium text-gray-900">Reviews</h2>
        {ratings.length === 0 ? (
          <p className="text-sm text-gray-500">No reviews yet.</p>
        ) : (
          <ul className="space-y-4">
            {ratings.map((r) => (
              <li key={r.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <Stars score={r.score} />
                  <time className="text-xs text-gray-400">
                    {r.createdAt.toLocaleDateString()}
                  </time>
                </div>
                <p className="mt-1 text-xs text-gray-500">{handle(r.authorId)}</p>
                {r.comment && (
                  <p className="mt-2 text-sm text-gray-700">{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
