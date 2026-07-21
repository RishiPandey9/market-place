import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Messages" };

// Inbox: every order the user is part of (as buyer or seller) is a possible
// conversation. We surface those with at least one message, plus the order's
// counterpart, most-recent first.
export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/messages");
  const userId = session.user.id;

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
      messages: { some: {} },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      listing: { select: { title: true } },
      buyer: { select: { email: true } },
      seller: { select: { email: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true },
      },
    },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">
        Messages
      </h1>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 py-16 text-center">
          <p className="text-sm text-ink-soft">No conversations yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-brand-50 rounded-2xl border border-brand-100">
          {orders.map((o) => {
            const counterpart =
              o.buyerId === userId ? o.seller.email : o.buyer.email;
            const last = o.messages[0];
            return (
              <li key={o.id}>
                <Link
                  href={`/messages/${o.id}`}
                  className="block px-4 py-3 hover:bg-brand-50/60"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">
                      {o.listing.title}
                    </p>
                    <span className="text-xs text-ink-soft">{counterpart}</span>
                  </div>
                  {last && (
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {last.content}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
