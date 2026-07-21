import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NewTicketForm } from "@/components/support/NewTicketForm";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/support");

  const tickets = await prisma.supportTicket.findMany({
    where: { requesterId: session.user.id },
    orderBy: { lastReplyAt: "desc" },
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      lastReplyAt: true,
    },
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Support
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Open a ticket and our team will get back to you. You can also check{" "}
          <Link href="/help" className="underline">
            Help &amp; FAQ
          </Link>
          .
        </p>
      </div>

      {tickets.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink">Your tickets</h2>
          <ul className="mt-3 divide-y divide-brand-50 rounded-2xl border border-brand-100 bg-white">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/support/${t.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-brand-50/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {t.subject}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {t.category} · updated{" "}
                      {new Date(t.lastReplyAt).toLocaleDateString()}
                    </p>
                  </div>
                  <TicketStatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-ink">
          Open a new ticket
        </h2>
        <div className="mt-4">
          <NewTicketForm />
        </div>
      </section>
    </div>
  );
}
