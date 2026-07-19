import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notificationPreferencesSchema } from "@/lib/validation";

// Notification preferences for the signed-in user (Phase 3.2). The row is created
// lazily: absence means schema defaults (transactional on, marketing off).

// GET /api/settings/notifications — return the user's prefs, or defaults.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({
    preferences: prefs ?? {
      emailOrders: true,
      emailMessages: true,
      emailMarketing: false,
      pushOrders: true,
      pushMessages: true,
      pushMarketing: false,
    },
  });
}

// PATCH /api/settings/notifications — upsert the toggles the user changed.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = notificationPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: parsed.data,
    create: { userId: session.user.id, ...parsed.data },
  });

  return NextResponse.json({ preferences });
}
