import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/ratelimit";
import { clientIp, recordAudit } from "@/lib/audit";
import {
  generateReferralCode,
  isValidReferralCodeFormat,
  normalizeReferralCode,
} from "@/lib/referral";

// Create a User with a unique referral code, retrying on the (rare) unique
// collision. The DB unique constraint on User.referralCode is the source of
// truth; this loop just re-rolls the code if we lose the race.
async function createUserWithReferralCode(data: {
  email: string;
  passwordHash: string;
  currency?: string;
  country?: string;
}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.user.create({
        data: { ...data, referralCode: generateReferralCode() },
        select: {
          id: true,
          email: true,
          verificationLevel: true,
          referralCode: true,
          createdAt: true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[] | undefined)?.includes("referralCode")
      ) {
        continue; // code collision — re-roll
      }
      throw err;
    }
  }
  throw new Error("Could not generate a unique referral code");
}

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

  const { email, password, referralCode } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Do not reveal whether the account has a password vs. is OAuth-only.
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  // Resolve an inbound referral code (if any) to a referrer BEFORE creating the
  // user, so we can reject a self-referral and skip invalid codes silently — a
  // bad code must never block an otherwise-valid signup.
  let referrer: { id: string } | null = null;
  if (referralCode && isValidReferralCodeFormat(referralCode)) {
    referrer = await prisma.user.findUnique({
      where: { referralCode: normalizeReferralCode(referralCode) },
      select: { id: true },
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await createUserWithReferralCode({
    email,
    passwordHash,
    currency: process.env.DEFAULT_CURRENCY ?? undefined,
    country: process.env.DEFAULT_COUNTRY ?? undefined,
  });

  await recordAudit({ action: "auth_register", userId: user.id, metadata: { ip } });

  // Record the referral edge. Self-referral is impossible here (the code was
  // resolved to a pre-existing user, and this user was just created). Best
  // effort: a referral write must never fail the signup itself.
  if (referrer && referrer.id !== user.id) {
    try {
      await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: user.id,
          code: normalizeReferralCode(referralCode!),
        },
      });
      await recordAudit({
        action: "referral_signup",
        userId: user.id,
        metadata: { referrerId: referrer.id },
      });
    } catch {
      // referredId unique or other transient failure — ignore, signup stands.
    }
  }

  return NextResponse.json({ user }, { status: 201 });
}
