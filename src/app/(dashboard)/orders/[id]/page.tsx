import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ConfirmDeliveryButton } from "@/components/order/ConfirmDeliveryButton";
import { ShipOrderButton } from "@/components/order/ShipOrderButton";
import { RatingForm } from "@/components/order/RatingForm";

function fmt(amount: string, currency: string) {
  const n = Number(amount);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid — awaiting dispatch",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered — confirm to release payment",
  RELEASED: "Completed",
  DISPUTED: "Dispute open",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/orders/${id}`);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, title: true, images: true } },
      dispute: true,
    },
  });
  if (!order) notFound();

  const userId = session.user.id;
  const isBuyer = order.buyerId === userId;
  const isSeller = order.sellerId === userId;
  if (!isBuyer && !isSeller) notFound();

  // On a completed order, offer a rating unless this user already left one.
  const myRating =
    order.status === "RELEASED"
      ? await prisma.rating.findFirst({
          where: { orderId: order.id, authorId: userId },
          select: { id: true },
        })
      : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      {created && (
        <div className="mb-6 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          Order placed. Your payment is held in escrow until you confirm delivery.
        </div>
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {order.listing.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Order {order.id}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      <div className="mb-6 space-y-2 rounded-lg border border-gray-200 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Item</span>
          <span>{fmt(order.itemPrice.toString(), order.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Shipping</span>
          <span>{fmt(order.shippingPrice.toString(), order.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Buyer protection</span>
          <span>{fmt(order.protectionFee.toString(), order.currency)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 font-semibold">
          <span>Total</span>
          <span>{fmt(order.totalPrice.toString(), order.currency)}</span>
        </div>
      </div>

      {(order.trackingNumber || order.shippingCarrier) && (
        <div className="mb-6 rounded-lg border border-gray-200 p-4 text-sm">
          <h2 className="mb-2 font-medium text-gray-900">Tracking</h2>
          {order.shippingCarrier && (
            <p className="text-gray-600">Carrier: {order.shippingCarrier}</p>
          )}
          {order.trackingNumber && (
            <p className="text-gray-600">Tracking #: {order.trackingNumber}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {isSeller && order.status === "PAID" && (
          <ShipOrderButton orderId={order.id} />
        )}
        {isBuyer && order.status === "DELIVERED" && (
          <ConfirmDeliveryButton orderId={order.id} />
        )}
        <a
          href={`/messages/${order.id}`}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Message {isBuyer ? "seller" : "buyer"}
        </a>
        {isBuyer && (order.status === "PAID" || order.status === "SHIPPED" || order.status === "DELIVERED") && !order.dispute && (
          <a
            href={`/orders/${order.id}/dispute`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Report a problem
          </a>
        )}
      </div>

      {order.status === "RELEASED" && !myRating && (
        <div className="mt-6">
          <RatingForm orderId={order.id} />
        </div>
      )}
    </main>
  );
}
