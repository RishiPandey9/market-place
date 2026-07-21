import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";
import { AccountMenu } from "@/components/nav/AccountMenu";

// Shared site header used across the marketplace (home + all dashboard pages).
// Sticky, brand-forward: logo mark, prominent search, category pills, and a
// session-aware action cluster so signed-in users can always reach their
// listings, orders, messages, wallet, and sign out.
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
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
        {/* Brand */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm">
            R
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">
            Reloved
          </span>
        </Link>

        {/* Search — center, grows to fill */}
        <form
          action="/search"
          className="relative hidden flex-1 items-center md:flex"
        >
          <svg
            className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
            />
          </svg>
          <input
            name="q"
            placeholder="Search items, brands, members…"
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-ink transition placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </form>

        {/* Actions */}
        <nav className="flex shrink-0 items-center gap-1 text-sm">
          {session?.user ? (
            <>
              <HeaderIconLink href="/messages" label="Messages">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 01-4-.83L3 20l1.3-3.1A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </HeaderIconLink>
              <HeaderIconLink href="/orders" label="Orders">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </HeaderIconLink>
              <HeaderIconLink href="/wallet" label="Wallet">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h18M3 10a2 2 0 012-2h14a2 2 0 012 2m-18 0v8a2 2 0 002 2h14a2 2 0 002-2v-8M16 14h2"
                />
              </HeaderIconLink>

              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  className="ml-1 hidden rounded-full px-3 py-1.5 font-medium text-brand-700 hover:bg-brand-50 lg:inline-block"
                >
                  Admin
                </Link>
              )}

              <Link
                href="/listings/new"
                className="ml-1 rounded-full bg-brand-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Sell now
              </Link>

              {/* Account cluster — dropdown keeps every destination reachable */}
              <div className="ml-1">
                <AccountMenu email={session.user.email ?? ""} isAdmin={isAdmin} />
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 font-medium text-ink hover:bg-gray-100"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-brand-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* Mobile search */}
      <form action="/search" className="px-4 pb-3 md:hidden">
        <input
          name="q"
          placeholder="Search items, brands…"
          className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </form>

      {/* Category strip */}
      {categories.length > 0 && (
        <div className="border-t border-gray-100">
          <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
            <Link
              href="/feed"
              className="whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-ink-soft transition hover:bg-gray-100 hover:text-ink"
            >
              For you
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.id}`}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-ink-soft transition hover:bg-gray-100 hover:text-ink"
              >
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

// Small icon link used in the header action cluster. Children are the <path>(s)
// for a 24×24 stroked icon.
function HeaderIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="hidden h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-gray-100 hover:text-ink sm:flex"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        {children}
      </svg>
    </Link>
  );
}
