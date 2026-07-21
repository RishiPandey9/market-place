import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DisputeForm } from "@/components/order/DisputeForm";

// NOTE: /orders/[id]/dispute is not in the documented page map; added to host
// the dispute form (POST /api/disputes is documented). Flagged as an addition.
export default async function RaiseDisputePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/orders/${id}/dispute`);

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      status: true,
      dispute: { select: { id: true } },
      listing: { select: { title: true } },
    },
  });
  if (!order) notFound();

  const userId = session.user.id;
  if (order.buyerId !== userId && order.sellerId !== userId) notFound();

  const disputable =
    !order.dispute &&
    ["PAID", "SHIPPED", "DELIVERED"].includes(order.status);

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <Link href={`/orders/${order.id}`} className="text-xs text-ink-soft hover:text-ink">
        ← Back to order
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold tracking-tight text-ink">
        Report a problem
      </h1>
      <p className="mb-6 text-sm text-ink-soft">{order.listing.title}</p>

      {order.dispute ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          A dispute is already open for this order and is under review.
        </p>
      ) : !disputable ? (
        <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink-soft">
          This order can no longer be disputed.
        </p>
      ) : (
        <DisputeForm orderId={order.id} />
      )}
    </main>
  );
}
