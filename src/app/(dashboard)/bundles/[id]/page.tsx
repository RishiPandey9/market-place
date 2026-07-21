import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateBundlePricing } from "@/lib/bundle";
import { BundleCheckoutForm } from "@/components/bundle/BundleCheckoutForm";

export const metadata = { title: "Your bundle" };

// Bundle detail / checkout (SOW §09). A draft bundle the buyer assembled on a
// seller's page: review the items, then check out — one escrow Order per item,
// shipping charged once. Non-draft bundles are shown read-only.
export default async function BundlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/bundles/${id}`);
  const buyerId = session.user.id;

  const bundle = await prisma.bundle.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              currency: true,
              country: true,
              status: true,
              images: true,
              sellerId: true,
            },
          },
        },
      },
    },
  });

  if (!bundle || bundle.buyerId !== buyerId) notFound();

  const listings = bundle.items.map((it) => it.listing);
  const currency = listings[0]?.currency ?? "GBP";
  const country = listings[0]?.country ?? "GB";

  // Preview pricing (shipping is applied at checkout; here we show item +
  // protection so the buyer sees the per-item breakdown before paying).
  const pricing = calculateBundlePricing(
    listings.map((l) => ({ listingId: l.id, itemPrice: Number(l.price) })),
    0,
  );

  const isDraft = bundle.status === "draft";
  const allActive = listings.every((l) => l.status === "ACTIVE");

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">
        Your bundle
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        {listings.length} item{listings.length === 1 ? "" : "s"} from one seller · ship together, pay postage once.
      </p>

      <ul className="mb-6 space-y-3">
        {listings.map((l) => (
          <li
            key={l.id}
            className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3"
          >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-50">
              {l.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.images[0]} alt={l.title} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{l.title}</p>
              {l.status !== "ACTIVE" && (
                <p className="text-xs font-medium text-rose-600">No longer available</p>
              )}
            </div>
            <span className="text-sm font-semibold text-ink">
              {new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(l.price))}
            </span>
          </li>
        ))}
      </ul>

      {bundle.status !== "draft" ? (
        <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-ink-soft">
          This bundle is <span className="font-semibold capitalize">{bundle.status}</span>.
          {bundle.status === "offered" && " Track the items in your orders."}
        </p>
      ) : !allActive ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          One or more items are no longer available, so this bundle can&apos;t be checked out.
        </p>
      ) : (
        <BundleCheckoutForm
          bundleId={bundle.id}
          itemsSubtotal={pricing.itemsSubtotal}
          protectionSubtotal={pricing.protectionSubtotal}
          currency={currency}
          country={country}
        />
      )}

      {isDraft && (
        <p className="mt-4 text-center text-xs text-ink-soft">
          Changed your mind? You can just leave this bundle — it won&apos;t be charged until you pay.
        </p>
      )}
    </main>
  );
}
