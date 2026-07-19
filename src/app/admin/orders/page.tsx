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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">
        Orders
      </h1>
      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 text-gray-900">{o.listing.title}</td>
                  <td className="px-4 py-3 text-gray-600">{o.buyer.email}</td>
                  <td className="px-4 py-3 text-gray-600">{o.seller.email}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.currency} {o.totalPrice.toString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
