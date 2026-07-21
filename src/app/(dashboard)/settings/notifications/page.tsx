import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NotificationForm } from "@/components/settings/NotificationForm";

export const metadata = { title: "Notification settings" };

const DEFAULTS = {
  emailOrders: true,
  emailMessages: true,
  emailMarketing: false,
  pushOrders: true,
  pushMessages: true,
  pushMarketing: false,
};

export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings/notifications");

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: session.user.id },
    select: {
      emailOrders: true,
      emailMessages: true,
      emailMarketing: true,
      pushOrders: true,
      pushMessages: true,
      pushMarketing: true,
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Notifications</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Choose which updates you receive. Delivery wiring (email/SMS) lands with
        the notification service; your choices are saved now.
      </p>
      <div className="mt-6">
        <NotificationForm initial={prefs ?? DEFAULTS} />
      </div>
    </div>
  );
}
