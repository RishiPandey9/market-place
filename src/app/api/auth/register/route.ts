import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/ratelimit";
import { clientIp, recordAudit } from "@/lib/audit";

// POST /api/auth/register
// Email/password signup. Rate-limited per IP, validates input, enforces
// password strength, hashes with bcrypt, and creates a Level 1 User. The
// password is never logged and the response never includes passwordHash.
export async function POST(req: Request) {
  const ip = clientIp(req.headers);

  // Abuse guard: cap new-account creation per IP.
  const limit = rateLimit(`register:${ip}`, RATE_LIMITS.register);
  if (!limit.ok) {
    await recordAudit({ action: "auth_rate_limited", metadata: { ip, route: "register" } });
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Do not reveal whether the account has a password vs. is OAuth-only.
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      currency: process.env.DEFAULT_CURRENCY ?? undefined,
      country: process.env.DEFAULT_COUNTRY ?? undefined,
    },
    select: {
      id: true,
      email: true,
      verificationLevel: true,
      createdAt: true,
    },
  });

  await recordAudit({ action: "auth_register", userId: user.id, metadata: { ip } });

  return NextResponse.json({ user }, { status: 201 });
}
