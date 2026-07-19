import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AddressManager } from "@/components/settings/AddressManager";

export const metadata = { title: "Address settings" };

export default async function AddressSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings/addresses");

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Addresses</h1>
      <p className="mt-1 text-sm text-gray-500">
        Shipping addresses used at checkout. Your default is pre-selected.
      </p>
      <div className="mt-6">
        <AddressManager initial={addresses} />
      </div>
    </div>
  );
}
