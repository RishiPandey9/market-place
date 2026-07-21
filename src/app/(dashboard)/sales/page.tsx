import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

function fmt(amount: string, currency: string) {
  const n = Number(amount);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid — ship now",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RELEASED: "Completed",
  DISPUTED: "Dispute open",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export const metadata = { title: "My sales" };

export default async function SalesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/sales");

  const orders = await prisma.order.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { listing: { select: { title: true, images: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">
        My sales
      </h1>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 py-16 text-center">
          <p className="text-sm text-ink-soft">No sales yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-brand-50 rounded-2xl border border-brand-100">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-brand-50/60"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{o.listing.title}</p>
                  <p className="text-xs text-ink-soft">
                    {fmt(o.totalPrice.toString(), o.currency)}
                  </p>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
