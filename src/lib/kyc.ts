import crypto from "node:crypto";

import { VerificationLevel } from "@prisma/client";

// ==============================================================
// KYC / identity-verification client (Phase 2 — Level 3 verification)
// ==============================================================
// Approved stack: Veriff / Onfido / Persona (one, TBD). Provider keys are
// deferred per the project owner, so this module provides a SANDBOX client that
// issues deterministic fake verification sessions when no provider key is set.
//
// SANDBOX FLAG: this MUST be swapped for a real KYC provider before any real
// withdrawal goes live (CLAUDE.md hard-constraint #8). It is gated on
// KYC_PROVIDER_API_KEY — set the key and implement the live branch to switch
// over. The withdrawal gate itself (LEVEL_3_ID_VERIFIED required) is real in
// both modes; only the identity-check backend is sandboxed.

// The withdrawal KYC gate itself (LEVEL_3 required) lives in the money module
// (`escrow.checkWithdrawalEligibility`). This module only handles the identity
// provider integration. The withdrawal gate is real in both sandbox and live
// modes; only the identity-check backend is sandboxed.

export type KycSession = {
  provider: string;
  providerRefId: string;
  // Where the user is sent to complete the identity check. In sandbox this is a
  // local placeholder; live providers return a hosted flow URL.
  redirectUrl: string;
  sandbox: boolean;
};

// Normalised verification outcome. Providers use different status strings; the
// webhook maps them onto this before touching our data model.
export type KycDecision = "approved" | "rejected" | "pending";

function sandboxEnabled(): boolean {
  return !process.env.KYC_PROVIDER_API_KEY;
}

export function isKycSandbox(): boolean {
  return sandboxEnabled();
}

// Begin an identity-verification session for a user. In sandbox we mint a
// deterministic ref so repeat calls and the paired webhook line up.
export async function startVerification(userId: string): Promise<KycSession> {
  if (sandboxEnabled()) {
    const providerRefId = `sbx-kyc-${userId}`;
    return {
      provider: "sandbox",
      providerRefId,
      redirectUrl: `https://sandbox.local/kyc/${providerRefId}`,
      sandbox: true,
    };
  }

  // TODO(live): call the configured provider's create-session endpoint.
  throw new Error(
    "Live KYC session creation not implemented — KYC_PROVIDER_API_KEY is set but no live client exists yet.",
  );
}

// Map a provider-specific status string onto our normalised decision. Covers the
// common vocabularies (Veriff/Onfido/Persona) plus the sandbox's own values.
export function mapProviderStatus(status: string): KycDecision {
  const s = status.toLowerCase();
  if (["approved", "approve", "clear", "completed", "verified"].includes(s)) {
    return "approved";
  }
  if (["rejected", "declined", "consider", "failed"].includes(s)) {
    return "rejected";
  }
  return "pending";
}

// The verification level an approved identity check grants.
export function levelForApprovedKyc(): VerificationLevel {
  return VerificationLevel.LEVEL_3_ID_VERIFIED;
}

// HMAC-SHA256 signature verification for the KYC webhook, mirroring the shipping
// webhook. Real providers vary (Onfido uses HMAC-SHA256, Persona HMAC, Veriff
// HMAC) — swap the header/scheme for the chosen provider before launch. If the
// secret is unset the caller must reject: never accept unverified webhooks.
export function verifyKycSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
