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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">
        Verification queue
      </h1>
      {records.length === 0 ? (
        <p className="text-sm text-gray-500">No pending verifications.</p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-gray-200 bg-white p-4 text-sm"
            >
              <p className="text-gray-900">User {r.userId}</p>
              <p className="text-xs text-gray-500">
                {r.provider} · {r.providerRefId} · {r.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
