import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TicketReplyForm } from "@/components/support/TicketReplyForm";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { userCanReply } from "@/lib/ticket";

export const metadata = { title: "Support ticket" };

type PageProps = { params: Promise<{ id: string }> };

export default async function SupportTicketPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/support");
  const { id } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      requesterId: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fromStaff: true, body: true, createdAt: true },
      },
    },
  });

  // 404 for both missing and not-owned so we don't reveal a ticket's existence.
  if (!ticket || ticket.requesterId !== session.user.id) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/support" className="text-sm text-ink-soft hover:text-ink">
        ← Back to support
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {ticket.subject}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {ticket.category} · opened{" "}
            {new Date(ticket.createdAt).toLocaleDateString()}
          </p>
        </div>
        <TicketStatusBadge status={ticket.status} />
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
              {m.fromStaff ? "Support" : "You"} ·{" "}
              {new Date(m.createdAt).toLocaleString()}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
              {m.body}
            </p>
          </li>
        ))}
      </ul>

      <section className="mt-8">
        {userCanReply(ticket.status) ? (
          <TicketReplyForm ticketId={ticket.id} />
        ) : (
          <p className="text-sm text-ink-soft">
            This ticket is closed. Please open a new ticket if you still need
            help.
          </p>
        )}
      </section>
    </div>
  );
}
