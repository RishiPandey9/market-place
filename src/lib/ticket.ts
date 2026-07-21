import { TicketStatus } from "@prisma/client";

// Support-ticket state machine (Phase 3.3). Pure logic, DB-free, so it can be
// unit-tested. A ticket moves between OPEN/PENDING/RESOLVED/CLOSED driven by who
// replies and explicit staff actions.

export const TICKET_CATEGORIES = [
  "billing",
  "shipping",
  "account",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

// The status a ticket lands in after a new reply, given who sent it. A user
// reply (re)opens the conversation for staff (OPEN); a staff reply flips it to
// PENDING (awaiting the user). A reply on a CLOSED ticket does not resurrect it —
// closed is terminal until an agent explicitly reopens.
export function statusAfterReply(
  current: TicketStatus,
  fromStaff: boolean,
): TicketStatus {
  if (current === TicketStatus.CLOSED) return TicketStatus.CLOSED;
  return fromStaff ? TicketStatus.PENDING : TicketStatus.OPEN;
}

// Whether a user (the requester) may still post to their ticket. Closed tickets
// are read-only for users; everything else accepts a reply.
export function userCanReply(status: TicketStatus): boolean {
  return status !== TicketStatus.CLOSED;
}

// Allowed explicit status changes an agent may set, beyond the automatic
// reply-driven transitions. Agents can resolve or close from any open-ish state,
// and reopen a resolved/closed ticket back to OPEN.
const AGENT_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.OPEN]: [TicketStatus.PENDING, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  [TicketStatus.PENDING]: [TicketStatus.OPEN, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  [TicketStatus.RESOLVED]: [TicketStatus.OPEN, TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [TicketStatus.OPEN],
};

export function agentCanSetStatus(
  from: TicketStatus,
  to: TicketStatus,
): boolean {
  if (from === to) return false;
  return AGENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTicketCategory(value: string): value is TicketCategory {
  return (TICKET_CATEGORIES as readonly string[]).includes(value);
}
