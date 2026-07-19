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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">
        Listings
      </h1>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Seller</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              {canModerate && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {listings.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-gray-900">{l.title}</td>
                <td className="px-4 py-3 text-gray-600">{l.seller.email}</td>
                <td className="px-4 py-3 text-gray-600">
                  {l.currency} {l.price.toString()}
                </td>
                <td className="px-4 py-3 text-gray-600">{l.status}</td>
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
