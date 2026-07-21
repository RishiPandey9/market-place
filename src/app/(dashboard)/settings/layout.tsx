import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { SettingsNav } from "@/components/settings/SettingsNav";

// Account settings shell (Phase 3.2). Auth-gated at the layout level so every
// /settings/* page requires a signed-in user; each page also re-checks the
// session for its own data fetch. The sub-nav mirrors the admin console pattern.
const NAV: { href: string; label: string }[] = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/addresses", label: "Addresses" },
  { href: "/settings/payouts", label: "Payouts" },
  { href: "/settings/payment-methods", label: "Payment methods" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/referrals", label: "Referrals" },
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 md:flex-row">
      <aside className="w-full shrink-0 md:w-52">
        <p className="mb-1 text-lg font-semibold tracking-tight text-ink">Settings</p>
        <p className="mb-4 text-sm text-ink-soft">Manage your account</p>
        <SettingsNav links={NAV} />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
