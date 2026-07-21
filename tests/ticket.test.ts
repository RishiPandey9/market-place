import { describe, it, expect } from "vitest";
import { TicketStatus } from "@prisma/client";

import {
  statusAfterReply,
  userCanReply,
  agentCanSetStatus,
  isTicketCategory,
} from "@/lib/ticket";

describe("statusAfterReply", () => {
  it("a user reply (re)opens the ticket for staff", () => {
    expect(statusAfterReply(TicketStatus.PENDING, false)).toBe(
      TicketStatus.OPEN,
    );
    expect(statusAfterReply(TicketStatus.RESOLVED, false)).toBe(
      TicketStatus.OPEN,
    );
  });

  it("a staff reply moves the ticket to PENDING (awaiting user)", () => {
    expect(statusAfterReply(TicketStatus.OPEN, true)).toBe(
      TicketStatus.PENDING,
    );
  });

  it("a reply on a CLOSED ticket never resurrects it", () => {
    expect(statusAfterReply(TicketStatus.CLOSED, false)).toBe(
      TicketStatus.CLOSED,
    );
    expect(statusAfterReply(TicketStatus.CLOSED, true)).toBe(
      TicketStatus.CLOSED,
    );
  });
});

describe("userCanReply", () => {
  it("allows replies on open-ish tickets", () => {
    expect(userCanReply(TicketStatus.OPEN)).toBe(true);
    expect(userCanReply(TicketStatus.PENDING)).toBe(true);
    expect(userCanReply(TicketStatus.RESOLVED)).toBe(true);
  });

  it("blocks replies once closed", () => {
    expect(userCanReply(TicketStatus.CLOSED)).toBe(false);
  });
});

describe("agentCanSetStatus", () => {
  it("allows resolving/closing an open ticket", () => {
    expect(agentCanSetStatus(TicketStatus.OPEN, TicketStatus.RESOLVED)).toBe(
      true,
    );
    expect(agentCanSetStatus(TicketStatus.PENDING, TicketStatus.CLOSED)).toBe(
      true,
    );
  });

  it("allows reopening a resolved or closed ticket", () => {
    expect(agentCanSetStatus(TicketStatus.RESOLVED, TicketStatus.OPEN)).toBe(
      true,
    );
    expect(agentCanSetStatus(TicketStatus.CLOSED, TicketStatus.OPEN)).toBe(
      true,
    );
  });

  it("rejects a no-op transition", () => {
    expect(agentCanSetStatus(TicketStatus.OPEN, TicketStatus.OPEN)).toBe(false);
  });

  it("rejects an illegal jump (closed → resolved)", () => {
    expect(agentCanSetStatus(TicketStatus.CLOSED, TicketStatus.RESOLVED)).toBe(
      false,
    );
  });
});

describe("isTicketCategory", () => {
  it("accepts known categories", () => {
    expect(isTicketCategory("billing")).toBe(true);
    expect(isTicketCategory("other")).toBe(true);
  });

  it("rejects unknown categories", () => {
    expect(isTicketCategory("nonsense")).toBe(false);
  });
});
