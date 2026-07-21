import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReferralCode } from "@/lib/referral";
import { CopyButton } from "@/components/settings/CopyButton";

export const metadata = { title: "Referrals" };

// Ensure the signed-in user has a referral code. Accounts created before the
// referral feature (or via OAuth) have none; backfill lazily on first visit,
// retrying on the rare unique collision.
async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (user?.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not assign a referral code");
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Signed up",
  QUALIFIED: "Qualified",
  REWARDED: "Rewarded",
};

export default async function ReferralsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings/referrals");

  const code = await ensureReferralCode(session.user.id);

  const referrals = await prisma.referral.findMany({
    where: { referrerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      referred: { select: { email: true } },
    },
  });

  const base = process.env.NEXTAUTH_URL ?? "";
  const link = `${base}/signup?ref=${code}`;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Referrals
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Invite friends with your code. When someone signs up using it, they
          appear below.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Your code</h2>
          <div className="mt-2 flex max-w-lg items-center justify-between gap-4 rounded-2xl border border-brand-100 bg-white px-4 py-3">
            <span className="font-mono text-lg tracking-widest text-ink">
              {code}
            </span>
            <CopyButton value={code} label="Copy code" />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-ink">
            Your invite link
          </h2>
          <div className="mt-2 flex max-w-lg items-center justify-between gap-4 rounded-2xl border border-brand-100 bg-white px-4 py-3">
            <span className="truncate text-sm text-ink-soft">{link}</span>
            <CopyButton value={link} label="Copy link" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">
          People you&apos;ve referred ({referrals.length})
        </h2>
        {referrals.length === 0 ? (
          <p className="mt-2 max-w-md text-sm text-ink-soft">
            No referrals yet. Share your code to get started.
          </p>
        ) : (
          <ul className="mt-4 max-w-lg divide-y divide-brand-50 rounded-2xl border border-brand-100 bg-white">
            {referrals.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {maskEmail(r.referred.email)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    Joined {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Show a referred user's email partially masked — the referrer shouldn't see the
// full address of someone who used their link.
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "hidden";
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}
