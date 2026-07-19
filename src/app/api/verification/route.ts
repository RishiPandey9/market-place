import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startVerification, isKycSandbox } from "@/lib/kyc";

// POST /api/verification — Begin a Level 3 identity-verification session (Phase 2).
//
// Creates a KYC provider session for the signed-in user and records a pending
// VerificationRecord so the admin queue can track it. The provider's async
// webhook (/api/webhooks/kyc) delivers the final decision and, on approval,
// upgrades the user to LEVEL_3_ID_VERIFIED — the gate that unlocks withdrawals.
//
// SANDBOX FLAG: in the absence of KYC_PROVIDER_API_KEY this returns a sandbox
// session (see /src/lib/kyc.ts). Swap for a real provider before launch.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, verificationLevel: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const kyc = await startVerification(user.id);

  // Upsert a pending record for this provider ref so repeat starts don't stack.
  const existing = await prisma.verificationRecord.findFirst({
    where: { userId: user.id, providerRefId: kyc.providerRefId },
    select: { id: true },
  });
  if (existing) {
    await prisma.verificationRecord.update({
      where: { id: existing.id },
      data: { status: "pending" },
    });
  } else {
    await prisma.verificationRecord.create({
      data: {
        userId: user.id,
        provider: kyc.provider,
        providerRefId: kyc.providerRefId,
        status: "pending",
      },
    });
  }

  return NextResponse.json({
    redirectUrl: kyc.redirectUrl,
    providerRefId: kyc.providerRefId,
    sandbox: isKycSandbox(),
  });
}
