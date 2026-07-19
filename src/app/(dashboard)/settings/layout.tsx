import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

// Account settings shell (Phase 3.2). Auth-gated at the layout level so every
// /settings/* page requires a signed-in user; each page also re-checks the
// session for its own data fetch. The sub-nav mirrors the admin console pattern.
const NAV: { href: string; label: string }[] = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/addresses", label: "Addresses" },
  { href: "/settings/notifications", label: "Notifications" },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/settings/profile");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl gap-8 px-4 py-10">
      <aside className="w-48 shrink-0">
        <p className="mb-4 text-sm font-semibold text-gray-900">Settings</p>
        <nav className="space-y-1">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
