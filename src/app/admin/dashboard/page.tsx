import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";

// Admin dashboard — at-a-glance operational counts. Gated by the admin layout
// (admin.access); individual figures are only queried, never mutated here.
export default async function AdminDashboardPage() {
  const ctx = await getAdminContext();
  const can = (p: Parameters<NonNullable<typeof ctx>["permissions"]["has"]>[0]) =>
    ctx?.permissions.has(p) ?? false;

  const [users, activeListings, pendingListings, openDisputes, paidOrders] =
    await Promise.all([
      can("users.read") ? prisma.user.count() : Promise.resolve(null),
      can("listings.read")
        ? prisma.listing.count({ where: { status: "ACTIVE" } })
        : Promise.resolve(null),
      can("listings.read")
        ? prisma.listing.count({ where: { status: "PENDING_REVIEW" } })
        : Promise.resolve(null),
      can("disputes.read")
        ? prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } })
        : Promise.resolve(null),
      can("orders.read")
        ? prisma.order.count({ where: { status: "PAID" } })
        : Promise.resolve(null),
    ]);

  const cards: { label: string; value: number | null }[] = [
    { label: "Total users", value: users },
    { label: "Active listings", value: activeListings },
    { label: "Listings awaiting review", value: pendingListings },
    { label: "Open disputes", value: openDisputes },
    { label: "Paid orders in flight", value: paidOrders },
  ].filter((c) => c.value !== null);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">
        Dashboard
      </h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-gray-200 bg-white p-5"
          >
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
