import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validation";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/ratelimit";
import { recordAudit } from "@/lib/audit";

// POST /api/settings/password — change the signed-in user's password (Phase 3.2).
//
// Verifies the current password with bcrypt before setting a new hash (cost 12,
// matching register). Rate-limited per user to blunt online-guessing of the
// current password. Never logs or returns any password material. Accounts with
// no local password (Google-only) can't change one here — they have nothing to
// verify against.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reuse the auth throttle: repeated current-password attempts are auth-like.
  const limit = rateLimit(`password-change:${session.user.id}`, RATE_LIMITS.auth);
  if (!limit.ok) {
    await recordAudit({
      action: "auth_rate_limited",
      userId: session.user.id,
      metadata: { route: "password-change" },
    });
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  });

  // Google-only accounts have no local password to verify.
  if (!user?.passwordHash) {
    return NextResponse.json(
      { error: "This account has no password set. Sign in with your provider." },
      { status: 400 },
    );
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    await recordAudit({
      action: "password_change_failed",
      userId: session.user.id,
      metadata: { reason: "bad_current_password" },
    });
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  await recordAudit({ action: "password_changed", userId: session.user.id });

  return NextResponse.json({ ok: true });
}
