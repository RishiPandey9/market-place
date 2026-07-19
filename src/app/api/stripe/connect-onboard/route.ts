import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createConnectOnboardingLink } from "@/lib/stripe";

// POST /api/stripe/connect-onboard
// Creates (or reuses) the seller's Stripe Connect Express account and returns
// a fresh onboarding link. Requires an authenticated user.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      country: true,
      stripeAccountId: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const { accountId, url } = await createConnectOnboardingLink({
    existingAccountId: user.stripeAccountId,
    email: user.email,
    country: user.country ?? process.env.DEFAULT_COUNTRY ?? "GB",
    refreshUrl: `${appUrl}/settings/profile?stripe=refresh`,
    returnUrl: `${appUrl}/settings/profile?stripe=return`,
  });

  // Persist the account id if it was just created.
  if (accountId !== user.stripeAccountId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountId: accountId },
    });
  }

  return NextResponse.json({ url });
}
