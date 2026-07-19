import { prisma } from "@/lib/db";

// Centralized audit logging (Phase 2 security & compliance).
//
// Sensitive actions — auth events, money movement, admin actions — are written
// to the AuditLog table through this single helper so the shape stays uniform
// and the call sites stay terse. Writes are best-effort: an audit failure must
// never break the user-facing action, so errors are swallowed after logging.
//
// NEVER pass secrets, passwords, tokens, or full card data in `metadata`.

// Known audit actions. This is not exhaustive — several routes build action
// strings dynamically (e.g. `listing_${action}`, `dispute_resolved_${outcome}`)
// — so `AuditEntry.action` widens to accept any string while keeping these as
// documented, autocompleted values for the common cases.
export type KnownAuditAction =
  // auth
  | "auth_login_success"
  | "auth_login_failed"
  | "auth_register"
  | "auth_rate_limited"
  // money
  | "wallet_withdraw"
  | "withdraw_rate_limited"
  // trust & safety
  | "dispute_raised"
  | "dispute_rate_limited"
  // orders
  | "order_confirmed"
  // account settings
  | "profile_updated"
  | "password_changed"
  | "password_change_failed"
  // admin
  | "user_suspended"
  | "user_reactivated"
  | "admin_role_assigned"
  | "admin_role_revoked"
  // verification
  | "kyc_webhook"
  | "verification_started";

// Accept any string (dynamic actions) while still autocompleting known ones.
export type AuditAction = KnownAuditAction | (string & {});

export type AuditEntry = {
  action: AuditAction;
  /** The acting user, when known. Null for anonymous/pre-auth events. */
  userId?: string | null;
  /** Structured context. Must not contain secrets. */
  metadata?: Record<string, unknown>;
};

/**
 * Extract the best-effort client IP from a request's headers.
 *
 * Behind Vercel/most proxies the real client is the first entry in
 * `x-forwarded-for`; `x-real-ip` is a common fallback. Returns "unknown" when
 * neither is present (e.g. direct local requests) so callers always have a
 * non-empty rate-limit key.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * Write an audit entry. Best-effort — never throws; failures are logged to the
 * server console (never the password/secret payload) and otherwise ignored.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? undefined,
        action: entry.action,
        metadata: (entry.metadata ?? undefined) as never,
      },
    });
  } catch (err) {
    // Do not surface audit failures to the caller; surface for ops only.
    console.error(`[audit] failed to record ${entry.action}:`, err);
  }
}
