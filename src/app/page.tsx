import Link from "next/link";

import { prisma } from "@/lib/db";
import { ListingCard } from "@/components/listing/ListingCard";
import { SiteHeader } from "@/components/nav/SiteHeader";
import { SiteFooter } from "@/components/nav/SiteFooter";

// Category tile artwork. Interim stock imagery served locally from
// /public/categories + /public/products, keyed by seed category name; real
// category hero images would be managed via the CMS (ContentPage / campaigns).
const CATEGORY_ART: Record<string, string> = {
  Women: "/categories/1483985988355-763728e1935b.jpg",
  Men: "/products/1516257984-b1b4d707412e.jpg",
  Kids: "/categories/1519689680058-324335c77eba.jpg",
  Designer: "/products/1584917865442-de89df76afd3.jpg",
  Electronics: "/products/1505740420928-5e560c06d30e.jpg",
};

const FEATURES = [
  {
    title: "Secure escrow",
    body: "Your money is held safely until you confirm the item arrived as described.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" />
    ),
  },
  {
    title: "Verified members",
    body: "Sellers can verify identity, email and phone so you always know who you're buying from.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  {
    title: "Tracked shipping",
    body: "Prepaid, tracked labels on every order so both sides can follow the parcel.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 5h11v9H3V5zm11 3h4l3 3v3h-7V8z" />
    ),
  },
];

export default async function Home() {
  const [listings, categories] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { category: { select: { name: true } } },
    }),
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-brand-50">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-14 lg:grid-cols-2 lg:py-20">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Pre-loved, protected, delivered
              </span>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
                Buy and sell{" "}
                <span className="text-brand-600">pre-loved</span> fashion
              </h1>
              <p className="mt-4 max-w-md text-base text-ink-soft">
                Thousands of items from real members. Every purchase is protected
                by secure escrow until you confirm delivery.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/feed"
                  className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                >
                  Start shopping
                </Link>
                <Link
                  href="/listings/new"
                  className="rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-brand-300 hover:text-brand-700"
                >
                  Sell an item
                </Link>
              </div>
            </div>

            {/* Hero collage */}
            <div className="relative hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4 pt-8">
                  <HeroTile src="/products/1544022613-e87ca75a784a.jpg" />
                  <HeroTile src="/products/1542291026-7eec264c27ff.jpg" />
                </div>
                <div className="space-y-4">
                  <HeroTile src="/products/1584917865442-de89df76afd3.jpg" />
                  <HeroTile src="/products/1595777457583-95e059d581b8.jpg" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Category tiles */}
        {categories.length > 0 && (
          <section className="mx-auto w-full max-w-6xl px-4 py-12">
            <div className="mb-5 flex items-end justify-between">
              <h2 className="text-xl font-bold tracking-tight text-ink">
                Shop by category
              </h2>
              <Link href="/feed" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/category/${c.id}`}
                  className="card-hover group relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl bg-gray-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={CATEGORY_ART[c.name] ?? CATEGORY_ART.Women}
                    alt={c.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  <span className="relative m-3 text-sm font-semibold text-white">
                    {c.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Latest listings */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-4">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-xl font-bold tracking-tight text-ink">
              Fresh listings
            </h2>
            <Link href="/feed" className="text-sm font-medium text-brand-700 hover:text-brand-800">
              See more
            </Link>
          </div>

          {listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
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

        {/* Trust strip */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14">
          <div className="grid gap-4 rounded-3xl bg-gray-50 p-6 sm:grid-cols-3 sm:p-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    {f.icon}
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function HeroTile({ src }: { src: string }) {
  return (
    <div className="card-hover aspect-[3/4] overflow-hidden rounded-2xl border border-white bg-gray-100 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
    </div>
  );
}
