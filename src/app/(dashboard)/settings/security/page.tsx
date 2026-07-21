import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { SessionManager } from "@/components/settings/SessionManager";

export const metadata = { title: "Security settings" };

export default async function SecuritySettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings/security");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, twoFactorEnabled: true },
  });
  if (!user) redirect("/login");

  const hasPassword = Boolean(user.passwordHash);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Security</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Manage your password and account protection.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink">Password</h2>
        <div className="mt-4">
          {hasPassword ? (
            <ChangePasswordForm />
          ) : (
            <p className="max-w-md text-sm text-ink-soft">
              This account signs in with an external provider (e.g. Google) and
              has no password set.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Active sessions</h2>
        <p className="mb-4 mt-1 max-w-md text-sm text-ink-soft">
          Devices currently signed in to your account. Sign out any you don&apos;t
          recognize — you&apos;ll be alerted here and by notification when a new
          device signs in.
        </p>
        <SessionManager />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">
          Two-factor authentication
        </h2>
        <p className="mt-2 max-w-md text-sm text-ink-soft">
          2FA for login and withdrawals is{" "}
          {user.twoFactorEnabled ? "enabled" : "not yet enabled"}. The
          authenticator-app flow is planned for a later Phase 2 hardening pass
          and is not available to configure here yet.
        </p>
      </section>
    </div>
  );
}
