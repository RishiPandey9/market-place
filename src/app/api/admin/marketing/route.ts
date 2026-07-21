import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requirePermission, RbacError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { campaignSchema } from "@/lib/validation";
import { CampaignType } from "@prisma/client";

// GET /api/admin/marketing — list marketing campaigns (newest first).
// RBAC: requires `marketing.read`.
export async function GET() {
  try {
    await requirePermission("marketing.read");
  } catch (e) {
    if (e instanceof RbacError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ campaigns });
}

// POST /api/admin/marketing — create a campaign (BANNER / FEATURED / EMAIL).
// RBAC: requires `marketing.manage`. Audit-logged.
export async function POST(req: Request) {
  let adminId: string;
  try {
    const ctx = await requirePermission("marketing.manage");
    adminId = ctx.userId;
  } catch (e) {
    if (e instanceof RbacError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = campaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { name, type, active, startsAt, endsAt, payload } = parsed.data;

  const campaign = await prisma.campaign.create({
    data: {
      name,
      type: type as CampaignType,
      active: active ?? false,
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
      payload: (payload ?? undefined) as never,
      createdById: adminId,
    },
  });

  await recordAudit({
    userId: adminId,
    action: "campaign_created",
    metadata: { campaignId: campaign.id, name, type },
  });

  return NextResponse.json({ ok: true, campaign }, { status: 201 });
}
