import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";
import { SignOutButton } from "@/components/nav/SignOutButton";

// Shared site header used across the marketplace (home + all dashboard pages).
// Shows search, category nav, and a session-aware action cluster so signed-in
// users can always reach their listings, orders, messages, and sign out.
export async function SiteHeader() {
  const session = await getServerSession(authOptions);

  const [categories, adminCtx] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    session?.user ? getAdminContext() : Promise.resolve(null),
  ]);

  const isAdmin = Boolean(adminCtx?.permissions.has("admin.access"));

  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-gray-900"
        >
          Marketplace
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {session?.user ? (
            <>
              <Link
                href="/orders"
                className="font-medium text-gray-600 hover:text-gray-900"
              >
                Orders
              </Link>
              <Link
                href="/sales"
                className="font-medium text-gray-600 hover:text-gray-900"
              >
                Sales
              </Link>
              <Link
                href="/messages"
                className="font-medium text-gray-600 hover:text-gray-900"
              >
                Messages
              </Link>
              <Link
                href="/my-listings"
                className="font-medium text-gray-600 hover:text-gray-900"
              >
                My listings
              </Link>
              <Link
                href="/wallet"
                className="font-medium text-gray-600 hover:text-gray-900"
              >
                Wallet
              </Link>
              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  className="font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/listings/new"
                className="rounded-md bg-gray-900 px-3 py-1.5 font-medium text-white hover:bg-gray-800"
              >
                Sell an item
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-medium text-gray-600 hover:text-gray-900"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-gray-900 px-3 py-1.5 font-medium text-white hover:bg-gray-800"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 pb-3">
        <form action="/search" className="flex gap-2">
          <input
            name="q"
            placeholder="Search for items, brands…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Search
          </button>
        </form>
        {categories.length > 0 && (
          <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.id}`}
                className="text-gray-600 hover:text-gray-900"
              >
                {c.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
