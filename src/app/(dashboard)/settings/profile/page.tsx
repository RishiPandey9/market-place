import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProfileForm } from "@/components/settings/ProfileForm";

export const metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings/profile");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      phone: true,
      country: true,
      currency: true,
      language: true,
    },
  });
  if (!user) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Profile</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Your contact details and regional preferences.
      </p>
      <div className="mt-6">
        <ProfileForm
          email={user.email}
          initial={{
            phone: user.phone ?? "",
            country: user.country ?? "",
            currency: user.currency ?? "",
            language: user.language ?? "",
          }}
        />
      </div>
    </div>
  );
}
