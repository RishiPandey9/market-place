import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAddressSchema } from "@/lib/validation";

// Address book for the signed-in user (Phase 3.2). All rows are owner-scoped by
// userId — a user can only ever read or create their own addresses.

// GET /api/settings/addresses — list the user's addresses (default first).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ addresses });
}

// POST /api/settings/addresses — add a new address. If flagged default (or it's
// the user's first address), it becomes the sole default in one transaction.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createAddressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { isDefault, line2, ...rest } = parsed.data;
  const existingCount = await prisma.address.count({ where: { userId } });
  // First address is always the default; otherwise honor the flag.
  const makeDefault = isDefault || existingCount === 0;

  const address = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.address.create({
      data: {
        userId,
        line1: rest.line1,
        line2: line2 ? line2 : null,
        city: rest.city,
        postalCode: rest.postalCode,
        country: rest.country,
        isDefault: makeDefault,
      },
    });
  });

  return NextResponse.json({ address }, { status: 201 });
}
