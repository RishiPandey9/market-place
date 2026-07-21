import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

// ==============================================================
// Session / device management (Phase 1.3)
// ==============================================================
// We run NextAuth on the JWT strategy (no DB adapter), so "sessions" are not
// stored by NextAuth itself. This module maintains our own UserSession rows so
// we can offer device tracking, remote logout, and suspicious-login detection.
//
// The JWT carries the UserSession id as `sid`. auth.ts:
//   - creates a row (via startSession) inside the Credentials authorize step,
//     where the request headers (IP / user-agent) are available, and
//   - validates the sid on every request (via touchSession) so a revoked row
//     forces that device to be logged out on its next call.

// Coarse device label derived from a user-agent string. Pure + testable — used
// only for a human-readable "device" name in the session list, never for auth.
export function deviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent.toLowerCase();
  let os = "Unknown OS";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios"))
    os = "iOS";
  else if (ua.includes("linux")) os = "Linux";

  let browser = "browser";
  // Order matters: Edge/Chrome UAs also contain "safari"/"chrome" tokens.
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome") && !ua.includes("edg/")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";

  return `${browser} on ${os}`;
}

// Is this sign-in from a device/IP the user hasn't been seen on before? Pure so
// it can be unit-tested: given the set of (ip, userAgent) pairs from the user's
// prior non-revoked sessions, decide whether the new pair is novel.
export function isNewDevice(
  priorSessions: { ip: string | null; userAgent: string | null }[],
  current: { ip: string | null; userAgent: string | null },
): boolean {
  if (priorSessions.length === 0) return false; // first-ever login isn't "suspicious"
  return !priorSessions.some(
    (s) => s.ip === current.ip && s.userAgent === current.userAgent,
  );
}

// Extract IP + user-agent from the header bag NextAuth hands to authorize().
// Mirrors audit.clientIp but works off a plain header record (authorize's `req`
// exposes headers as an object, not a Fetch Headers instance).
export function requestFingerprint(
  headers: Record<string, string> | undefined,
): { ip: string | null; userAgent: string | null } {
  if (!headers) return { ip: null, userAgent: null };
  const forwarded = headers["x-forwarded-for"];
  const ip =
    (forwarded ? forwarded.split(",")[0]?.trim() : undefined) ??
    headers["x-real-ip"] ??
    null;
  const userAgent = headers["user-agent"] ?? null;
  return { ip: ip || null, userAgent: userAgent || null };
}

// Create a UserSession row for a fresh sign-in and return its id (the `sid`).
// Also runs suspicious-login detection: if the (ip, userAgent) pair is novel for
// this user, write an audit row and an in-app notification so the user can react
// (e.g. via remote logout). Best-effort side effects never block the login.
export async function startSession(params: {
  userId: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<string> {
  const prior = await prisma.userSession.findMany({
    where: { userId: params.userId, revokedAt: null },
    select: { ip: true, userAgent: true },
    take: 50,
  });

  const novel = isNewDevice(prior, { ip: params.ip, userAgent: params.userAgent });

  const session = await prisma.userSession.create({
    data: {
      userId: params.userId,
      ip: params.ip,
      userAgent: params.userAgent,
    },
    select: { id: true },
  });

  if (novel) {
    await recordAudit({
      action: "auth_new_device_login",
      userId: params.userId,
      metadata: { ip: params.ip, device: deviceLabel(params.userAgent) },
    });
    // Best-effort security notification; never block login if it fails.
    try {
      await prisma.notification.create({
        data: {
          userId: params.userId,
          channel: "EMAIL",
          title: "New sign-in to your account",
          body: `We noticed a sign-in from a new device (${deviceLabel(
            params.userAgent,
          )}). If this wasn't you, change your password and sign out other sessions in Settings → Security.`,
        },
      });
    } catch (err) {
      console.error("[session] failed to write new-device notification:", err);
    }
  }

  return session.id;
}

// Validate a session id from a JWT. Returns true if the session exists and is
// not revoked. Updates lastSeenAt opportunistically. A revoked/missing session
// returns false so the caller (jwt callback) can invalidate the token — this is
// what makes remote logout take effect.
export async function isSessionActive(sid: string): Promise<boolean> {
  const session = await prisma.userSession.findUnique({
    where: { id: sid },
    select: { id: true, revokedAt: true },
  });
  if (!session || session.revokedAt) return false;

  // Fire-and-forget last-seen bump; staleness here is harmless.
  prisma.userSession
    .update({ where: { id: sid }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return true;
}

// Revoke one session (remote logout of a specific device), owner-scoped.
// Returns false if the session doesn't exist or isn't the caller's.
export async function revokeSession(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const result = await prisma.userSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

// Revoke every other active session for a user, keeping `exceptSid` (the current
// device). Used for "sign out everywhere else". Returns the number revoked.
export async function revokeOtherSessions(
  userId: string,
  exceptSid: string,
): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: { userId, revokedAt: null, id: { not: exceptSid } },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
