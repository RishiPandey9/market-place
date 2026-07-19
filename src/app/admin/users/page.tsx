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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">
        Users
      </h1>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">KYC</th>
              <th className="px-4 py-3">Listings</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-gray-900">{u.email}</td>
                <td className="px-4 py-3 text-gray-600">{u.verificationLevel}</td>
                <td className="px-4 py-3 text-gray-600">{u._count.listings}</td>
                <td className="px-4 py-3">
                  {u.suspended ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Suspended
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
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
