import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";

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
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Security</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your password and account protection.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-900">Password</h2>
        <div className="mt-4">
          {hasPassword ? (
            <ChangePasswordForm />
          ) : (
            <p className="max-w-md text-sm text-gray-500">
              This account signs in with an external provider (e.g. Google) and
              has no password set.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900">
          Two-factor authentication
        </h2>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          2FA for login and withdrawals is{" "}
          {user.twoFactorEnabled ? "enabled" : "not yet enabled"}. The
          authenticator-app flow is planned for a later Phase 2 hardening pass
          and is not available to configure here yet.
        </p>
      </section>
    </div>
  );
}
