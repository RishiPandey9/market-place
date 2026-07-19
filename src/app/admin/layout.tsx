import { redirect } from "next/navigation";
import Link from "next/link";

import { getAdminContext } from "@/lib/rbac";
import type { Permission } from "@/lib/rbac";

// Admin console layout. This is the single RBAC gate for the whole /admin tree:
// anyone without at least `admin.access` is redirected away. Individual pages
// and every admin API handler additionally check their specific permission.
const NAV: { href: string; label: string; perm: Permission }[] = [
  { href: "/admin/dashboard", label: "Dashboard", perm: "admin.access" },
  { href: "/admin/users", label: "Users", perm: "users.read" },
  { href: "/admin/listings", label: "Listings", perm: "listings.read" },
  { href: "/admin/orders", label: "Orders", perm: "orders.read" },
  { href: "/admin/disputes", label: "Disputes", perm: "disputes.read" },
  { href: "/admin/verification-queue", label: "Verification", perm: "verification.read" },
  { href: "/admin/analytics", label: "Analytics", perm: "analytics.read" },
  { href: "/admin/roles", label: "Roles", perm: "roles.manage" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.permissions.has("admin.access")) {
    // Not an admin — do not reveal the console exists.
    redirect("/");
  }

  const links = NAV.filter((n) => ctx.permissions.has(n.perm));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white p-4">
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-900">Admin console</p>
          <p className="mt-1 text-xs text-gray-500">{ctx.roles.join(", ")}</p>
        </div>
        <nav className="space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-gray-100 pt-4">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
            ← Back to marketplace
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
