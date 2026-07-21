import { TicketStatus } from "@prisma/client";

// Shared visual mapping for ticket statuses (Phase 3.3), used by both the user
// support pages and the admin console so the labels/colors stay consistent.
const STYLES: Record<TicketStatus, { label: string; className: string }> = {
  [TicketStatus.OPEN]: {
    label: "Open",
    className: "bg-amber-50 text-amber-700",
  },
  [TicketStatus.PENDING]: {
    label: "Awaiting you",
    className: "bg-amber-50 text-amber-700",
  },
  [TicketStatus.RESOLVED]: {
    label: "Resolved",
    className: "bg-emerald-50 text-emerald-700",
  },
  [TicketStatus.CLOSED]: {
    label: "Closed",
    className: "bg-emerald-50 text-emerald-700",
  },
};

// `staffLabel` swaps the ambiguous "Awaiting you" for an agent-facing label.
export function TicketStatusBadge({
  status,
  staffLabel = false,
}: {
  status: TicketStatus;
  staffLabel?: boolean;
}) {
  const s = STYLES[status];
  const label =
    staffLabel && status === TicketStatus.PENDING ? "Awaiting user" : s.label;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}
    >
      {label}
    </span>
  );
}
