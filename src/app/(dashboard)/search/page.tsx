import { searchListings } from "@/lib/search";
import { searchQuerySchema } from "@/lib/validation";
import { ListingCard } from "@/components/listing/ListingCard";
import { SearchFilters } from "@/components/listing/SearchFilters";

export const metadata = { title: "Search" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValues(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v[0]) out[k] = v[0];
  }
  return out;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = firstValues(await searchParams);
  const parsed = searchQuerySchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : {};

  const { listings, total } = await searchListings(filters);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">
        Search
      </h1>

      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <aside>
          <SearchFilters />
        </aside>

        <section>
          <p className="mb-4 text-sm text-ink-soft">
            {total} {total === 1 ? "result" : "results"}
          </p>

          {listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-200 py-16 text-center">
              <p className="text-sm text-ink-soft">
                No listings match your search.
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
