"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Client nav for the admin console sidebar. Server layout does the RBAC
// filtering and passes only the links this admin may see; this component only
// handles the active-route highlight.
export function AdminNav({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
                : "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
