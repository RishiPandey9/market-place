import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requirePermission, RbacError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { campaignSchema } from "@/lib/validation";
import { CampaignType } from "@prisma/client";

// Partial update: reuse the create schema but make every field optional so an
// admin can just flip `active` without re-sending name/type.
const updateCampaignSchema = campaignSchema.partial();

// PATCH /api/admin/marketing/[id] — edit a campaign or toggle its active state.
// RBAC: requires `marketing.manage`. Audit-logged.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const parsed = updateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const d = parsed.data;
  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.type !== undefined ? { type: d.type as CampaignType } : {}),
      ...(d.active !== undefined ? { active: d.active } : {}),
      ...(d.startsAt !== undefined ? { startsAt: d.startsAt } : {}),
      ...(d.endsAt !== undefined ? { endsAt: d.endsAt } : {}),
      ...(d.payload !== undefined ? { payload: d.payload as never } : {}),
    },
  });

  await recordAudit({
    userId: adminId,
    action: "campaign_updated",
    metadata: { campaignId: campaign.id, changed: Object.keys(d) },
  });

  return NextResponse.json({ ok: true, campaign });
}

// DELETE /api/admin/marketing/[id] — remove a campaign.
// RBAC: requires `marketing.manage`. Audit-logged.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const existing = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  await prisma.campaign.delete({ where: { id } });
  await recordAudit({
    userId: adminId,
    action: "campaign_deleted",
    metadata: { campaignId: id, name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
