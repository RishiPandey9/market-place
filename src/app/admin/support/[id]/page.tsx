import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";
import { AdminTicketControls } from "@/components/admin/AdminTicketControls";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminSupportTicketPage({ params }: PageProps) {
  const ctx = await getAdminContext();
  if (!ctx?.permissions.has("support.read")) redirect("/admin/dashboard");
  const canManage = ctx.permissions.has("support.manage");
  const { id } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
      requester: { select: { email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fromStaff: true, body: true, createdAt: true },
      },
    },
  });
  if (!ticket) notFound();

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/support"
        className="text-sm text-ink-soft hover:text-ink"
      >
        ← Back to support queue
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {ticket.subject}
          </h1>
          <p className="mt-1 text-xs text-ink-soft">
            {ticket.requester.email} · {ticket.category} · opened{" "}
            {new Date(ticket.createdAt).toLocaleString()}
          </p>
        </div>
        <TicketStatusBadge status={ticket.status} staffLabel />
      </div>

      <ul className="mt-8 space-y-4">
        {ticket.messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-2xl border p-4 ${
              m.fromStaff
                ? "border-emerald-100 bg-emerald-50/50"
                : "border-brand-100 bg-white"
            }`}
          >
            <p className="text-xs font-medium text-ink-soft">
              {m.fromStaff ? "Support" : ticket.requester.email} ·{" "}
              {new Date(m.createdAt).toLocaleString()}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
              {m.body}
            </p>
          </li>
        ))}
      </ul>

      <section className="mt-8">
        {canManage ? (
          <AdminTicketControls ticketId={ticket.id} status={ticket.status} />
        ) : (
          <p className="text-sm text-ink-soft">
            You have read-only access to support tickets.
          </p>
        )}
      </section>
    </div>
  );
}
