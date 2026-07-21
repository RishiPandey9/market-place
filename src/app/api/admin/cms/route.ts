import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requirePermission, RbacError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { contentPageSchema } from "@/lib/validation";
import { ContentStatus } from "@prisma/client";

// GET /api/admin/cms — list content pages / blog posts (newest first).
// RBAC: requires `cms.read`.
export async function GET() {
  try {
    await requirePermission("cms.read");
  } catch (e) {
    if (e instanceof RbacError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const pages = await prisma.contentPage.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ pages });
}

// POST /api/admin/cms — create a content page / blog post with SEO fields.
// RBAC: requires `cms.manage`. Audit-logged. Slug must be unique.
export async function POST(req: Request) {
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

  const parsed = contentPageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Enforce unique slug up front for a clean error (also DB-constrained).
  const clash = await prisma.contentPage.findUnique({
    where: { slug: d.slug },
    select: { id: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: `A page with slug "${d.slug}" already exists` },
      { status: 409 },
    );
  }

  const status = (d.status ?? "DRAFT") as ContentStatus;
  const page = await prisma.contentPage.create({
    data: {
      slug: d.slug,
      title: d.title,
      body: d.body,
      isBlog: d.isBlog ?? false,
      status,
      metaTitle: d.metaTitle || null,
      metaDescription: d.metaDescription || null,
      authorId: adminId,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });

  await recordAudit({
    userId: adminId,
    action: "content_created",
    metadata: { contentPageId: page.id, slug: page.slug, status },
  });

  return NextResponse.json({ ok: true, page }, { status: 201 });
}
