import Link from "next/link";

// Global footer with legal + support links (Phase 3.2). Rendered on marketplace
// pages so terms/privacy/tax/help are always reachable.
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gray-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Marketplace</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/terms" className="hover:text-gray-900">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-gray-900">
            Privacy
          </Link>
          <Link href="/tax-info" className="hover:text-gray-900">
            Tax info
          </Link>
          <Link href="/help" className="hover:text-gray-900">
            Help
          </Link>
        </nav>
      </div>
    </footer>
  );
}
