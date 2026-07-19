import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

// PATCH /api/settings/profile — update the signed-in user's contact + locale
// fields (Phase 3.2). Owner-scoped: only ever mutates the session user's row.
// Empty strings clear the nullable columns; email changes are intentionally not
// handled here (that requires re-verification, a separate flow).
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

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Map "" → null (clear the column); leave undefined fields untouched.
  const data: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    data[key] = value === "" ? null : (value as string);
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      email: true,
      phone: true,
      country: true,
      currency: true,
      language: true,
    },
  });

  await recordAudit({
    action: "profile_updated",
    userId: session.user.id,
    metadata: { fields: Object.keys(data) },
  });

  return NextResponse.json({ user });
}
