import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";
import { ModerateListingControl } from "@/components/admin/ModerateListingControl";

// Admin listings / moderation queue. Read gated by `listings.read`; the
// approve/reject/hide controls only render with `listings.moderate`.
// Pending-review listings surface first so the queue is actionable.
export default async function AdminListingsPage() {
  const ctx = await getAdminContext();
  if (!ctx?.permissions.has("listings.read")) redirect("/admin/dashboard");
  const canModerate = ctx.permissions.has("listings.moderate");

  const listings = await prisma.listing.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      price: true,
      currency: true,
      seller: { select: { id: true, email: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Listings
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Pending-review listings appear first so the moderation queue stays actionable.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-brand-100 bg-brand-50 text-xs uppercase text-brand-700">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Seller</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              {canModerate && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-50">
            {listings.map((l) => (
              <tr key={l.id} className="hover:bg-brand-50/60">
                <td className="px-4 py-3 text-ink">{l.title}</td>
                <td className="px-4 py-3 text-ink-soft">{l.seller.email}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {l.currency} {l.price.toString()}
                </td>
                <td className="px-4 py-3 text-ink-soft">{l.status}</td>
                {canModerate && (
                  <td className="px-4 py-3">
                    <ModerateListingControl listingId={l.id} status={l.status} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
