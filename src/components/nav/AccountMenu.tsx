"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

type Item = { href: string; label: string };

// Account dropdown for the site header. Server-rendered header passes the
// signed-in user's email + admin flag; this client component owns the open/close
// state and keeps every account destination (listings, sales, wallet, settings)
// reachable from one avatar button.
export function AccountMenu({
  email,
  isAdmin,
}: {
  email: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = email?.[0]?.toUpperCase() ?? "U";

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selling: Item[] = [
    { href: "/my-listings", label: "My listings" },
    { href: "/sales", label: "Sales" },
    { href: "/listings/new", label: "Sell an item" },
  ];
  const account: Item[] = [
    { href: "/orders", label: "My orders" },
    { href: "/wallet", label: "Wallet & payouts" },
    { href: "/following", label: "Following" },
    { href: "/settings/profile", label: "Settings" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 transition hover:bg-brand-200"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-black/5"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">Signed in as</p>
            <p className="truncate text-sm font-medium text-ink">{email}</p>
          </div>

          <MenuSection label="Selling" items={selling} onNavigate={() => setOpen(false)} />
          <MenuSection label="Account" items={account} onNavigate={() => setOpen(false)} />

          {isAdmin && (
            <div className="border-t border-gray-100 py-1">
              <Link
                href="/admin/dashboard"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                role="menuitem"
              >
                Admin panel
              </Link>
            </div>
          )}

          <div className="border-t border-gray-100 py-1">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
              role="menuitem"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuSection({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: Item[];
  onNavigate: () => void;
}) {
  return (
    <div className="py-1">
      <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          onClick={onNavigate}
          role="menuitem"
          className="block px-4 py-2 text-sm text-ink hover:bg-gray-50"
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}
