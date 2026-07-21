import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";
import { AssignRoleControl } from "@/components/admin/AssignRoleControl";

// Admin roles management. Gated by `roles.manage` (SUPER_ADMIN). Lists current
// admins and their roles; the control assigns/revokes.
export default async function AdminRolesPage() {
  const ctx = await getAdminContext();
  if (!ctx?.permissions.has("roles.manage")) redirect("/admin/dashboard");

  const assignments = await prisma.adminRoleAssignment.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Admin roles
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Assign or revoke admin roles and review who currently has access.
      </p>

      <div className="mb-8">
        <AssignRoleControl />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-ink">Current admins</h2>
      {assignments.length === 0 ? (
        <p className="text-sm text-ink-soft">No admin roles assigned yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-brand-100 bg-brand-50 text-xs uppercase text-brand-700">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-brand-50/60">
                  <td className="px-4 py-3 text-ink">{a.user.email}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                    {a.user.id}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{a.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
