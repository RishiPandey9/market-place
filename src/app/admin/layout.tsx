import { redirect } from "next/navigation";
import Link from "next/link";

import { getAdminContext } from "@/lib/rbac";
import type { Permission } from "@/lib/rbac";
import { AdminNav } from "@/components/admin/AdminNav";

// Admin console layout. This is the single RBAC gate for the whole /admin tree:
// anyone without at least `admin.access` is redirected away. Individual pages
// and every admin API handler additionally check their specific permission.
const NAV: { href: string; label: string; perm: Permission }[] = [
  { href: "/admin/dashboard", label: "Dashboard", perm: "admin.access" },
  { href: "/admin/users", label: "Users", perm: "users.read" },
  { href: "/admin/listings", label: "Listings", perm: "listings.read" },
  { href: "/admin/orders", label: "Orders", perm: "orders.read" },
  { href: "/admin/disputes", label: "Disputes", perm: "disputes.read" },
  { href: "/admin/support", label: "Support", perm: "support.read" },
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
    <div className="flex min-h-screen bg-brand-50/40">
      <aside className="flex w-60 shrink-0 flex-col border-r border-brand-100 bg-white p-4">
        <Link href="/" className="mb-6 flex items-center gap-2 px-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            R
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">Reloved</span>
        </Link>

        <div className="mb-4 rounded-xl bg-brand-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
            Admin console
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-soft">{ctx.roles.join(", ")}</p>
        </div>

        <AdminNav links={links} />

        <div className="mt-auto border-t border-brand-100 pt-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-medium text-ink-soft transition hover:text-brand-700"
          >
            ← Back to marketplace
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
