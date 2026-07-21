import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";
import { ResolveDisputeControl } from "@/components/admin/ResolveDisputeControl";

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  UNDER_REVIEW: "bg-brand-50 text-brand-700",
  RESOLVED_REFUND: "bg-rose-50 text-rose-700",
  RESOLVED_RELEASE: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-brand-50 text-brand-700",
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
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Disputes
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Open disputes need staff review before escrow can be released or refunded.
      </p>
      {disputes.length === 0 ? (
        <p className="text-sm text-ink-soft">No disputes.</p>
      ) : (
        <ul className="space-y-4">
          {disputes.map((d) => {
            const open =
              d.status === "OPEN" || d.status === "UNDER_REVIEW";
            return (
              <li
                key={d.id}
                className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-ink">
                      {d.order.listing.title}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      Order {d.order.id} · {d.order.currency}{" "}
                      {d.order.totalPrice.toString()} · order state{" "}
                      {d.order.status}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[d.status] ?? "bg-brand-50 text-brand-700"}`}
                  >
                    {d.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-ink-soft">{d.reason}</p>
                {d.resolution && (
                  <p className="mt-2 text-xs text-ink-soft">
                    Resolution: {d.resolution}
                  </p>
                )}
                {open && canResolve && (
                  <ResolveDisputeControl disputeId={d.id} />
                )}
                {open && !canResolve && (
                  <p className="mt-3 text-xs text-ink-soft">
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
