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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">
        Admin roles
      </h1>

      <div className="mb-8">
        <AssignRoleControl />
      </div>

      <h2 className="mb-3 text-sm font-medium text-gray-900">Current admins</h2>
      {assignments.length === 0 ? (
        <p className="text-sm text-gray-500">No admin roles assigned yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 text-gray-900">{a.user.email}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {a.user.id}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
