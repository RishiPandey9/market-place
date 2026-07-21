import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAdminContext } from "@/lib/rbac";

// Admin KYC verification queue. Gated by `verification.read`. The review
// actions (approve/reject) are wired in Feature #10 (KYC + withdrawal gate)
// alongside /api/webhooks/kyc; this page lists pending records now so the queue
// is visible. Flagged: review controls land with the KYC feature.
export default async function VerificationQueuePage() {
  const ctx = await getAdminContext();
  if (!ctx?.permissions.has("verification.read")) redirect("/admin/dashboard");

  const records = await prisma.verificationRecord.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Verification queue
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Pending KYC records awaiting review before withdrawals are enabled.
      </p>
      {records.length === 0 ? (
        <p className="text-sm text-ink-soft">No pending verifications.</p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-brand-100 bg-white p-4 text-sm shadow-sm"
            >
              <p className="text-ink">User {r.userId}</p>
              <p className="text-xs text-ink-soft">
                {r.provider} · {r.providerRefId} · {r.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
