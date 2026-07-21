import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";
import { SuspendUserControl } from "@/components/admin/SuspendUserControl";

// Admin users table. Read gated by `users.read`; the suspend control only
// renders (and only works server-side) with `users.manage`.
export default async function AdminUsersPage() {
  const ctx = await getAdminContext();
  if (!ctx?.permissions.has("users.read")) redirect("/admin/dashboard");
  const canManage = ctx.permissions.has("users.manage");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      verificationLevel: true,
      suspended: true,
      createdAt: true,
      _count: { select: { listings: true, ordersAsBuyer: true, ordersAsSeller: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Users</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        The 100 most recently registered members.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white shadow-sm">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-brand-100 bg-brand-50 text-xs uppercase text-brand-700">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">KYC</th>
              <th className="px-4 py-3">Listings</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-50">
            {users.map((u) => (
              <tr key={u.id} className="transition hover:bg-brand-50/60">
                <td className="px-4 py-3 font-medium text-ink">{u.email}</td>
                <td className="px-4 py-3 text-ink-soft">{u.verificationLevel}</td>
                <td className="px-4 py-3 text-ink-soft">{u._count.listings}</td>
                <td className="px-4 py-3">
                  {u.suspended ? (
                    <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                      Suspended
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <SuspendUserControl userId={u.id} suspended={u.suspended} />
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
