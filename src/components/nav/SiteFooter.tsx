import Link from "next/link";

// Global footer with brand, discovery, and legal + support links (Phase 3.2).
// Rendered on marketplace pages so terms/privacy/tax/help are always reachable.
const SECTIONS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Marketplace",
    links: [
      { href: "/feed", label: "Browse" },
      { href: "/listings/new", label: "Sell an item" },
      { href: "/search", label: "Search" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/help", label: "Help centre" },
      { href: "/support", label: "Support" },
      { href: "/tax-info", label: "Tax info" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gray-100 bg-gray-50">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
              R
            </span>
            <span className="text-lg font-bold tracking-tight text-ink">
              Reloved
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-ink-soft">
            Buy and sell pre-loved fashion. Every purchase protected by secure
            escrow until you confirm delivery.
          </p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
            <ul className="mt-3 space-y-2">
              {section.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-ink-soft transition hover:text-brand-700"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-gray-400">
          <p>© {new Date().getFullYear()} Reloved. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" />
            </svg>
            Buyer protection on every order
          </p>
        </div>
      </div>
    </footer>
  );
}
