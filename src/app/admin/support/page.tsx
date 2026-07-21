import { redirect } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { TicketStatus } from "@prisma/client";

export default async function AdminSupportPage() {
  const ctx = await getAdminContext();
  if (!ctx?.permissions.has("support.read")) redirect("/admin/dashboard");

  // Actionable queue: OPEN (needs staff) + PENDING (awaiting user), most-recent
  // activity first.
  const tickets = await prisma.supportTicket.findMany({
    where: { status: { in: [TicketStatus.OPEN, TicketStatus.PENDING] } },
    orderBy: { lastReplyAt: "desc" },
    take: 100,
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      lastReplyAt: true,
      requester: { select: { email: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Support queue
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Open and pending tickets, sorted by most recent activity.
      </p>
      {tickets.length === 0 ? (
        <p className="text-sm text-ink-soft">No open tickets. 🎉</p>
      ) : (
        <ul className="divide-y divide-brand-50 rounded-2xl border border-brand-100 bg-white">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/support/${t.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-brand-50/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {t.subject}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {t.requester.email} · {t.category} · updated{" "}
                    {new Date(t.lastReplyAt).toLocaleString()}
                  </p>
                </div>
                <TicketStatusBadge status={t.status} staffLabel />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
