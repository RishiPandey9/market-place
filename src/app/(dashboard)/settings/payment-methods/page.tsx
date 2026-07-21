import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PaymentMethodsManager } from "@/components/settings/PaymentMethodsManager";

export const metadata = { title: "Payment methods" };

// Settings → Payment methods (SOW §05 "Add/edit payment method — cards/wallets
// for buying"). Cards used at checkout. PCI: only tokenized ids + brand/last4 are
// ever stored (see the API route and manager component).
export default async function PaymentMethodsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/settings/payment-methods");
  }

  const methods = await prisma.paymentMethod.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      brand: true,
      last4: true,
      expMonth: true,
      expYear: true,
      isDefault: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Payment methods</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Cards you can use to check out faster. Your card details are handled
          securely by our payment provider.
        </p>
      </div>
      <PaymentMethodsManager initial={methods} />
    </div>
  );
}
