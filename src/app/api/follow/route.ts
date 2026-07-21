import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { followSchema } from "@/lib/validation";

// Follow / unfollow a seller (SOW §02/§04 social layer). Idempotent toggle:
// POST with { sellerId, follow } — follow=true creates the row (no-op if it
// already exists), follow=false removes it. Self-follow is rejected. The
// (followerId, followingId) unique constraint makes the create idempotent.

// GET /api/follow — list who the signed-in user follows (ids only, for the
// follow-button state and the following feed).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followingId: true },
  });

  return NextResponse.json({ following: rows.map((r) => r.followingId) });
}

// POST /api/follow — toggle a follow relationship.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const followerId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = followSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { sellerId, follow } = parsed.data;

  if (sellerId === followerId) {
    return NextResponse.json(
      { error: "You cannot follow yourself." },
      { status: 400 },
    );
  }

  // The target must exist (avoid dangling follows).
  const target = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  }

  if (follow) {
    try {
      await prisma.follow.create({ data: { followerId, followingId: sellerId } });
    } catch (err) {
      // P2002 = already following; treat as a successful no-op (idempotent).
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError) ||
        err.code !== "P2002"
      ) {
        throw err;
      }
    }
  } else {
    await prisma.follow.deleteMany({
      where: { followerId, followingId: sellerId },
    });
  }

  await recordAudit({
    action: follow ? "seller_followed" : "seller_unfollowed",
    userId: followerId,
    metadata: { sellerId },
  });

  const followerCount = await prisma.follow.count({
    where: { followingId: sellerId },
  });

  return NextResponse.json({ ok: true, following: follow, followerCount });
}
