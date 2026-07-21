import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";

// Admin analytics. Gated by `analytics.read`. Basic marketplace KPIs computed
// from live data. Advanced dashboards/cohorts are Phase 4+ (deferred); this
// keeps the documented admin page present with real, non-stubbed figures.
export default async function AdminAnalyticsPage() {
  const ctx = await getAdminContext();
  if (!ctx?.permissions.has("analytics.read")) redirect("/admin/dashboard");

  const [users, listings, orders, released, gmvAgg] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "RELEASED" } }),
    prisma.order.aggregate({
      where: { status: { in: ["RELEASED", "DELIVERED", "SHIPPED", "PAID"] } },
      _sum: { totalPrice: true },
    }),
  ]);

  const gmv = gmvAgg._sum.totalPrice?.toString() ?? "0";

  const kpis = [
    { label: "Users", value: users },
    { label: "Listings", value: listings },
    { label: "Orders (all)", value: orders },
    { label: "Completed orders", value: released },
    { label: "GMV (captured)", value: gmv },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Analytics
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Core marketplace KPIs computed from live data.
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-ink-soft">{k.label}</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{k.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
