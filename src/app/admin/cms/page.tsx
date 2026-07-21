import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";
import { CreateContentControl } from "@/components/admin/CreateContentControl";
import { ContentRowControl } from "@/components/admin/ContentRowControl";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PUBLISHED: "bg-emerald-50 text-emerald-700",
    DRAFT: "bg-amber-50 text-amber-700",
    ARCHIVED: "bg-brand-50 text-ink-soft",
  };
  const label =
    status === "PUBLISHED" ? "Published" : status === "DRAFT" ? "Draft" : "Archived";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        map[status] ?? "bg-brand-50 text-ink-soft"
      }`}
    >
      {label}
    </span>
  );
}

export default async function AdminCmsPage() {
  const ctx = await getAdminContext();
  if (!ctx?.permissions.has("cms.read")) redirect("/admin/dashboard");

  const canManage = ctx.permissions.has("cms.manage");

  const pages = await prisma.contentPage.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const publishedCount = pages.filter((p) => p.status === "PUBLISHED").length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Content &amp; SEO
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Static pages, blog posts, and on-page SEO. {pages.length} total ·{" "}
            {publishedCount} published.
          </p>
        </div>
        {canManage && <CreateContentControl />}
      </div>

      {pages.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No content pages yet.{canManage ? " Create one above." : ""}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-100 bg-brand-50/60 text-xs uppercase tracking-wide text-brand-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">SEO</th>
                {canManage && <th className="px-4 py-3 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {pages.map((p) => (
                <tr key={p.id} className="align-top hover:bg-brand-50/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{p.title}</p>
                    <p className="text-xs text-ink-soft">/{p.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {p.isBlog ? "Blog post" : "Page"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    {p.metaTitle || p.metaDescription ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Set
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Missing
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <ContentRowControl pageId={p.id} status={p.status} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
