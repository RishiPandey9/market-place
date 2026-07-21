import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StartVerificationButton } from "@/components/verification/StartVerificationButton";

export const metadata = { title: "Identity verification" };

const LEVEL_LABEL: Record<string, string> = {
  LEVEL_1_BASIC: "Level 1 — Basic (email)",
  LEVEL_2_SELLER: "Level 2 — Seller",
  LEVEL_3_ID_VERIFIED: "Level 3 — ID verified",
};

// /verification — Level 3 KYC flow (Phase 2). Identity verification is required
// before any withdrawal can be made (see /wallet). Sellers start a provider
// session here; the provider's webhook completes the upgrade asynchronously.
export default async function VerificationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/verification");

  const [user, latestRecord] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { verificationLevel: true },
    }),
    prisma.verificationRecord.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { status: true, provider: true, createdAt: true },
    }),
  ]);

  const isVerified = user?.verificationLevel === "LEVEL_3_ID_VERIFIED";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-ink">
        Identity verification
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Verify your identity (Level 3) to unlock withdrawals of your sales
        earnings. This is a one-time check.
      </p>

      <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-soft">Current level</span>
          <span className="text-sm font-medium text-ink">
            {LEVEL_LABEL[user?.verificationLevel ?? "LEVEL_1_BASIC"]}
          </span>
        </div>

        {latestRecord && (
          <div className="mt-3 flex items-center justify-between border-t border-brand-100 pt-3">
            <span className="text-sm text-ink-soft">Latest check</span>
            <span className="text-sm text-ink-soft">
              {latestRecord.status}
              {latestRecord.provider ? ` · ${latestRecord.provider}` : ""}
            </span>
          </div>
        )}

        <div className="mt-5">
          {isVerified ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Your identity is verified. You can withdraw from your wallet.
            </div>
          ) : (
            <StartVerificationButton />
          )}
        </div>
      </div>
    </main>
  );
}
