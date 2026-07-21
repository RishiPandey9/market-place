import { randomInt } from "crypto";

// Referral-code helpers (Phase 3.2). Pure/deterministic functions kept separate
// from DB access so they can be unit-tested. Codes are short, uppercase,
// unambiguous (no 0/O/1/I) so they survive being read aloud or typed by hand.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes 0,O,1,I
const CODE_LENGTH = 8;

// A referral code as stored/compared: trimmed, uppercased, inner whitespace and
// dashes stripped so "abcd-1234" and "ABCD1234" match.
export function normalizeReferralCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]+/g, "");
}

// Format gate used before hitting the DB — cheap rejection of obvious garbage.
export function isValidReferralCodeFormat(input: string): boolean {
  const code = normalizeReferralCode(input);
  if (code.length !== CODE_LENGTH) return false;
  return [...code].every((ch) => ALPHABET.includes(ch));
}

// Generate a fresh code. randomInt is CSPRNG-backed and avoids modulo bias.
// Uniqueness is enforced by the DB unique constraint + a retry loop at the call
// site, not here.
export function generateReferralCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

// Whether a user may apply a given referral code to their own signup. A user
// cannot refer themselves (self-referral abuse). Comparison is on normalized
// codes so casing/formatting never lets a self-referral slip through.
export function canApplyReferral(args: {
  referrerCode: string;
  referredOwnCode: string | null;
}): boolean {
  if (!args.referredOwnCode) return true;
  return (
    normalizeReferralCode(args.referrerCode) !==
    normalizeReferralCode(args.referredOwnCode)
  );
}
