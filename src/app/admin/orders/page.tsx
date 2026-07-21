import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";

// Admin orders table — read-only oversight. Gated by `orders.read`.
export default async function AdminOrdersPage() {
  const ctx = await getAdminContext();
  if (!ctx?.permissions.has("orders.read")) redirect("/admin/dashboard");

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      totalPrice: true,
      currency: true,
      createdAt: true,
      listing: { select: { title: true } },
      buyer: { select: { email: true } },
      seller: { select: { email: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Orders
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Read-only oversight of the most recent marketplace orders.
      </p>
      {orders.length === 0 ? (
        <p className="text-sm text-ink-soft">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-brand-100 bg-brand-50 text-xs uppercase text-brand-700">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-brand-50/60">
                  <td className="px-4 py-3 text-ink">{o.listing.title}</td>
                  <td className="px-4 py-3 text-ink-soft">{o.buyer.email}</td>
                  <td className="px-4 py-3 text-ink-soft">{o.seller.email}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {o.currency} {o.totalPrice.toString()}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
