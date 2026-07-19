import { z } from "zod";

// Password strength rules (Phase 1.3): min 8 chars, at least one lowercase,
// one uppercase, and one digit. Kept here so the register route and any future
// password-change flow share one source of truth.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
