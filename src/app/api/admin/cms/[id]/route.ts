import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requirePermission, RbacError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { contentPageSchema } from "@/lib/validation";
import { ContentStatus } from "@prisma/client";

// Partial update: slug is immutable after creation (avoid breaking published
// URLs), so omit it; every other field optional.
const updateContentSchema = contentPageSchema.omit({ slug: true }).partial();

// PATCH /api/admin/cms/[id] — edit a content page or change its status.
// RBAC: requires `cms.manage`. Audit-logged. Sets publishedAt on first publish.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let adminId: string;
  try {
    const ctx = await requirePermission("cms.manage");
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

  const parsed = updateContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.contentPage.findUnique({
    where: { id },
    select: { id: true, status: true, publishedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const d = parsed.data;
  const nextStatus = (d.status ?? existing.status) as ContentStatus;
  // Stamp publishedAt the first time a page goes PUBLISHED; keep it otherwise.
  const publishedAt =
    nextStatus === "PUBLISHED" && !existing.publishedAt
      ? new Date()
      : existing.publishedAt;

  const page = await prisma.contentPage.update({
    where: { id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.body !== undefined ? { body: d.body } : {}),
      ...(d.isBlog !== undefined ? { isBlog: d.isBlog } : {}),
      ...(d.status !== undefined ? { status: nextStatus } : {}),
      ...(d.metaTitle !== undefined ? { metaTitle: d.metaTitle || null } : {}),
      ...(d.metaDescription !== undefined
        ? { metaDescription: d.metaDescription || null }
        : {}),
      publishedAt,
    },
  });

  await recordAudit({
    userId: adminId,
    action: "content_updated",
    metadata: { contentPageId: page.id, changed: Object.keys(d), status: nextStatus },
  });

  return NextResponse.json({ ok: true, page });
}

// DELETE /api/admin/cms/[id] — remove a content page.
// RBAC: requires `cms.manage`. Audit-logged.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let adminId: string;
  try {
    const ctx = await requirePermission("cms.manage");
    adminId = ctx.userId;
  } catch (e) {
    if (e instanceof RbacError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const existing = await prisma.contentPage.findUnique({
    where: { id },
    select: { id: true, slug: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  await prisma.contentPage.delete({ where: { id } });
  await recordAudit({
    userId: adminId,
    action: "content_deleted",
    metadata: { contentPageId: id, slug: existing.slug },
  });

  return NextResponse.json({ ok: true });
}
