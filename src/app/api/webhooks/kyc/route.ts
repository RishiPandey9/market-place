import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { mapProviderStatus, levelForApprovedKyc, verifyKycSignature } from "@/lib/kyc";

// POST /api/webhooks/kyc — KYC provider verification-result handler (Phase 2).
//
// Hard constraints (CLAUDE.md #4): verifies the signature and is idempotent.
// Idempotency uses AuditLog (action="kyc_webhook") keyed on the provider event
// id, mirroring the Stripe/shipping webhooks.
//
// On an APPROVED decision the user is upgraded to LEVEL_3_ID_VERIFIED — the gate
// that unlocks real withdrawals (#8). A matching VerificationRecord row is
// updated (or created) so the admin KYC queue reflects the outcome.
//
// SANDBOX FLAG: signature verification uses HMAC-SHA256 of the raw body with
// KYC_PROVIDER_WEBHOOK_SECRET. Real providers vary (Onfido/Persona/Veriff HMAC
// schemes differ) — swap for the chosen provider's scheme before launch. If the
// secret is unset we reject: never accept unverified webhooks.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_ACTION = "kyc_webhook";

type KycEvent = {
  id: string; // provider event id (idempotency key)
  userId: string; // our user id (sandbox refs embed this; live: map from providerRefId)
  provider: string;
  providerRefId: string;
  status: string; // provider-specific status string
};

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: { action: WEBHOOK_ACTION, metadata: { path: ["eventId"], equals: eventId } },
    select: { id: true },
  });
  return existing !== null;
}

export async function POST(req: Request) {
  const secret = process.env.KYC_PROVIDER_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[kyc webhook] KYC_PROVIDER_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-kyc-signature");
  if (!verifyKycSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: KycEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!event.id || !event.userId || !event.provider || !event.status) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const decision = mapProviderStatus(event.status);

  try {
    await applyDecision(event, decision);

    await prisma.auditLog.create({
      data: {
        action: WEBHOOK_ACTION,
        userId: event.userId,
        metadata: {
          eventId: event.id,
          provider: event.provider,
          providerRefId: event.providerRefId,
          decision,
        },
      },
    });
    return NextResponse.json({ received: true, decision });
  } catch (err) {
    console.error("[kyc webhook] handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

// Persist the verification outcome. On approval, upgrade the user to the level
// that unlocks withdrawals. Rejected/pending decisions record status only and
// never change the user's level (so a later rejection can't be a downgrade
// vector against an already-verified user — we only ever raise on approval).
async function applyDecision(
  event: KycEvent,
  decision: ReturnType<typeof mapProviderStatus>,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: event.userId },
    select: { id: true, verificationLevel: true },
  });
  if (!user) {
    console.warn(`[kyc webhook] no user for id ${event.userId}`);
    return;
  }

  const record = await prisma.verificationRecord.findFirst({
    where: { userId: user.id, providerRefId: event.providerRefId },
    select: { id: true },
  });

  const recordOp = record
    ? prisma.verificationRecord.update({
        where: { id: record.id },
        data: { status: decision },
      })
    : prisma.verificationRecord.create({
        data: {
          userId: user.id,
          provider: event.provider,
          providerRefId: event.providerRefId,
          status: decision,
        },
      });

  if (decision === "approved") {
    await prisma.$transaction([
      recordOp,
      prisma.user.update({
        where: { id: user.id },
        data: { verificationLevel: levelForApprovedKyc() },
      }),
    ]);
  } else {
    await recordOp;
  }
}
