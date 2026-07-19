import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";
import { ResolveDisputeControl } from "@/components/admin/ResolveDisputeControl";

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-800",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  RESOLVED_REFUND: "bg-red-100 text-red-700",
  RESOLVED_RELEASE: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

export default async function AdminDisputesPage() {
  const ctx = await getAdminContext();
  if (!ctx?.permissions.has("disputes.read")) redirect("/admin/dashboard");
  const canResolve = ctx.permissions.has("disputes.resolve");

  const disputes = await prisma.dispute.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      order: {
        select: {
          id: true,
          status: true,
          totalPrice: true,
          currency: true,
          listing: { select: { title: true } },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">
        Disputes
      </h1>
      {disputes.length === 0 ? (
        <p className="text-sm text-gray-500">No disputes.</p>
      ) : (
        <ul className="space-y-4">
          {disputes.map((d) => {
            const open =
              d.status === "OPEN" || d.status === "UNDER_REVIEW";
            return (
              <li
                key={d.id}
                className="rounded-lg border border-gray-200 bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {d.order.listing.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Order {d.order.id} · {d.order.currency}{" "}
                      {d.order.totalPrice.toString()} · order state{" "}
                      {d.order.status}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[d.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {d.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-700">{d.reason}</p>
                {d.resolution && (
                  <p className="mt-2 text-xs text-gray-500">
                    Resolution: {d.resolution}
                  </p>
                )}
                {open && canResolve && (
                  <ResolveDisputeControl disputeId={d.id} />
                )}
                {open && !canResolve && (
                  <p className="mt-3 text-xs text-gray-400">
                    You have read-only access to disputes.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
