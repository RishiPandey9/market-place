import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { searchListings } from "@/lib/search";
import { searchQuerySchema } from "@/lib/validation";
import { ListingCard } from "@/components/listing/ListingCard";
import { SearchFilters } from "@/components/listing/SearchFilters";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValues(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v[0]) out[k] = v[0];
  }
  return out;
}

// /category/[slug] — slug is the Category id (the Category model has no slug
// field; adding one would require a schema change/migration, so we route by id).
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;

  const category = await prisma.category.findUnique({
    where: { id: slug },
    select: { id: true, name: true },
  });
  if (!category) notFound();

  const raw = firstValues(await searchParams);
  const parsed = searchQuerySchema.safeParse(raw);
  // Force the category filter to this page's category regardless of the query.
  const filters = { ...(parsed.success ? parsed.data : {}), categoryId: category.id };

  const { listings, total } = await searchListings(filters);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <nav className="mb-2 text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-600">
          Home
        </Link>{" "}
        / <span className="text-gray-600">{category.name}</span>
      </nav>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">
        {category.name}
      </h1>

      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <aside>
          <SearchFilters basePath={`/category/${category.id}`} />
        </aside>

        <section>
          <p className="mb-4 text-sm text-gray-500">
            {total} {total === 1 ? "item" : "items"}
          </p>

          {listings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
              <p className="text-sm text-gray-500">
                No items in this category yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
