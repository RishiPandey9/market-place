import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";
import { CreateCampaignControl } from "@/components/admin/CreateCampaignControl";
import { CampaignRowControl } from "@/components/admin/CampaignRowControl";

const TYPE_LABEL: Record<string, string> = {
  BANNER: "Banner",
  FEATURED: "Featured",
  EMAIL: "Email",
};

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString() : "—";
}

export default async function AdminMarketingPage() {
  const ctx = await getAdminContext();
  if (!ctx?.permissions.has("marketing.read")) redirect("/admin/dashboard");

  const canManage = ctx.permissions.has("marketing.manage");

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const liveCount = campaigns.filter((c) => c.active).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Marketing &amp; promotions
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Campaigns, banners, and featured-item blocks. {campaigns.length} total ·{" "}
        {liveCount} live.
      </p>

      {canManage && (
        <div className="mb-8">
          <CreateCampaignControl />
        </div>
      )}

      {campaigns.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No campaigns yet.{canManage ? " Create one above." : ""}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-100 bg-brand-50/60 text-xs uppercase tracking-wide text-brand-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Campaign</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Window</th>
                {canManage && <th className="px-4 py-3 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-brand-50/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{c.name}</p>
                    <p className="text-xs text-ink-soft">
                      created {fmtDate(c.createdAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {TYPE_LABEL[c.type] ?? c.type}
                  </td>
                  <td className="px-4 py-3">
                    {c.active ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
                        Paused
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {fmtDate(c.startsAt)} → {fmtDate(c.endsAt)}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <CampaignRowControl campaignId={c.id} active={c.active} />
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
