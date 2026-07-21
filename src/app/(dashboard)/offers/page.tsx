import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { OfferStatus } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAct, isExpired, type OfferParty } from "@/lib/offer";
import { OfferRowControl } from "@/components/offer/OfferRowControl";

function formatPrice(amount: string, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      Number(amount),
    );
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  COUNTERED: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  DECLINED: "bg-rose-50 text-rose-600",
  EXPIRED: "bg-brand-50 text-ink-soft",
  WITHDRAWN: "bg-brand-50 text-ink-soft",
};

export const metadata = { title: "My offers" };

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ box?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/offers");
  const userId = session.user.id;

  const { box: boxParam } = await searchParams;
  const box = boxParam === "received" ? "received" : "sent";

  const offers = await prisma.offer.findMany({
    where: box === "received" ? { listing: { sellerId: userId } } : { buyerId: userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      listing: {
        select: { id: true, title: true, currency: true, images: true, sellerId: true },
      },
    },
  });

  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">My offers</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Price negotiations you&apos;ve made and received.
      </p>

      {/* Sent / received tabs */}
      <div className="mt-5 flex gap-1 rounded-full border border-brand-100 bg-white p-1 text-sm">
        <Link
          href="/offers?box=sent"
          className={`flex-1 rounded-full px-4 py-2 text-center font-medium transition ${
            box === "sent" ? "bg-brand-600 text-white" : "text-ink-soft hover:bg-brand-50"
          }`}
        >
          Offers I made
        </Link>
        <Link
          href="/offers?box=received"
          className={`flex-1 rounded-full px-4 py-2 text-center font-medium transition ${
            box === "received" ? "bg-brand-600 text-white" : "text-ink-soft hover:bg-brand-50"
          }`}
        >
          Offers on my items
        </Link>
      </div>

      {offers.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">
          {box === "sent"
            ? "You haven't made any offers yet."
            : "No one has made an offer on your items yet."}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {offers.map((o) => {
            const role: OfferParty = o.listing.sellerId === userId ? "seller" : "buyer";
            const lapsed =
              (o.status === OfferStatus.PENDING || o.status === OfferStatus.COUNTERED) &&
              isExpired(o.expiresAt, now);
            const status = lapsed ? "EXPIRED" : o.status;
            const image = o.listing.images[0] ?? null;

            return (
              <li
                key={o.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-100 bg-white p-4"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-50">
                  {image && (
                    <Image src={image} alt={o.listing.title} fill className="object-cover" sizes="56px" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/listing/${o.listing.id}`}
                    className="block truncate text-sm font-semibold text-ink hover:text-brand-700"
                  >
                    {o.listing.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    Offer: <span className="font-semibold text-ink">{formatPrice(o.amount.toString(), o.currency)}</span>
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                    STATUS_STYLES[status] ?? "bg-brand-50 text-ink-soft"
                  }`}
                >
                  {status.toLowerCase()}
                </span>
                <div className="w-full sm:w-auto">
                  <OfferRowControl
                    offerId={o.id}
                    listingId={o.listing.id}
                    role={role}
                    status={status}
                    canAccept={!lapsed && canAct(o.status, role, "accept")}
                    canRespond={!lapsed && canAct(o.status, role, "decline")}
                    canWithdraw={!lapsed && canAct(o.status, role, "withdraw")}
                    accepted={o.status === OfferStatus.ACCEPTED}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
