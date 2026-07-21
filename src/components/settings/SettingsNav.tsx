"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Client sub-nav for the account settings shell. Highlights the active section.
export function SettingsNav({ links }: { links: { href: string; label: string }[] }) {
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
                ? "block rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
                : "block rounded-xl px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
