import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ConversationThread } from "@/components/message/ConversationThread";

// /messages/[conversationId] — conversationId is the orderId (a conversation is
// scoped to an order). Only the order's buyer or seller may open it.
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/messages/${conversationId}`);
  }

  const order = await prisma.order.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      buyer: { select: { email: true } },
      seller: { select: { email: true } },
      listing: { select: { title: true } },
    },
  });
  if (!order) notFound();

  const userId = session.user.id;
  if (order.buyerId !== userId && order.sellerId !== userId) notFound();

  const counterpart = order.buyerId === userId ? order.seller.email : order.buyer.email;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-4">
        <Link href="/messages" className="text-xs text-ink-soft hover:text-ink">
          ← All messages
        </Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-ink">
          {order.listing.title}
        </h1>
        <p className="text-xs text-ink-soft">
          with {counterpart} ·{" "}
          <Link href={`/orders/${order.id}`} className="underline">
            view order
          </Link>
        </p>
      </div>

      <ConversationThread orderId={order.id} />
    </main>
  );
}
