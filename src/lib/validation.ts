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

// ==============================
// Listing (Phase 1.4 / 1.5)
// ==============================

// parcelSize tier from the Listing model comment: small/medium/large/custom.
export const parcelSizeSchema = z.enum(["small", "medium", "large", "custom"]);

// Publish flow (1.4): a listing is created either as a private DRAFT or pushed
// straight to ACTIVE. Moderation states (PENDING_REVIEW/REJECTED) and lifecycle
// states (RESERVED/SOLD) are set by the system, never by the seller directly.
const sellerSettableStatus = z.enum(["DRAFT", "ACTIVE"]);

// Base shape shared by create + update. Mirrors the Listing model in
// technical-foundation.md Section 1 exactly (field names + optionality).
const listingFields = {
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(5000),
  categoryId: z.string().min(1, "Choose a category"),
  brand: z.string().trim().max(80).optional().or(z.literal("")),
  size: z.string().trim().max(40).optional().or(z.literal("")),
  condition: z.string().trim().max(40).optional().or(z.literal("")),
  color: z.string().trim().max(40).optional().or(z.literal("")),
  // Decimal(10,2) in Postgres: positive, up to 8 integer digits, 2 decimals.
  price: z.coerce
    .number({ error: "Enter a price" })
    .positive("Price must be greater than 0")
    .max(99_999_999.99, "Price is too large")
    .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, {
      message: "Price can have at most 2 decimal places",
    }),
  currency: z.string().trim().length(3, "Use a 3-letter currency code").toUpperCase(),
  parcelSize: parcelSizeSchema,
  images: z.array(z.string().url("Each image must be a valid URL")).max(12).default([]),
  country: z.string().trim().length(2, "Use a 2-letter country code").toUpperCase(),
};

export const createListingSchema = z.object({
  ...listingFields,
  status: sellerSettableStatus.default("DRAFT"),
});

// Every field optional on edit; seller may also flip DRAFT <-> ACTIVE.
export const updateListingSchema = z
  .object({
    title: listingFields.title.optional(),
    description: listingFields.description.optional(),
    categoryId: listingFields.categoryId.optional(),
    brand: listingFields.brand,
    size: listingFields.size,
    condition: listingFields.condition,
    color: listingFields.color,
    price: listingFields.price.optional(),
    currency: listingFields.currency.optional(),
    parcelSize: listingFields.parcelSize.optional(),
    images: z.array(z.string().url("Each image must be a valid URL")).max(12).optional(),
    country: listingFields.country.optional(),
    status: sellerSettableStatus.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

// ==============================
// Search (Phase 1.6)
// ==============================
// Coerces raw querystring values (all strings) into the typed SearchFilters
// used by /src/lib/search.ts. Everything is optional; empty strings drop out.
const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const searchQuerySchema = z.object({
  q: optionalTrimmed,
  categoryId: optionalTrimmed,
  brand: optionalTrimmed,
  size: optionalTrimmed,
  condition: optionalTrimmed,
  color: optionalTrimmed,
  country: optionalTrimmed,
  minPrice: z.coerce.number().nonnegative().optional().catch(undefined),
  maxPrice: z.coerce.number().nonnegative().optional().catch(undefined),
  sort: z.enum(["recent", "price_asc", "price_desc"]).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
  perPage: z.coerce.number().int().positive().max(60).optional().catch(undefined),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

// ==============================
// Checkout / Orders (Phase 1.7 / 1.8)
// ==============================
// The buyer supplies a listing to purchase, a shipping address, and a chosen
// shipping option (rate). Item price + currency are taken server-side from the
// Listing (never trusted from the client). Shipping price is validated against
// the chosen rate server-side once the shipping integration lands; for now the
// client passes the selected shipping option id + price.
export const shippingAddressSchema = z.object({
  line1: z.string().trim().min(1, "Address line 1 is required").max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(120),
  postalCode: z.string().trim().min(1, "Postal code is required").max(20),
  country: z.string().trim().length(2, "Use a 2-letter country code").toUpperCase(),
});

export const createOrderSchema = z.object({
  listingId: z.string().min(1, "listingId is required"),
  address: shippingAddressSchema,
  shippingOptionId: z.string().trim().min(1).optional(),
  shippingPrice: z.coerce
    .number({ error: "Enter a shipping price" })
    .nonnegative("Shipping price cannot be negative")
    .max(9_999.99)
    .refine((n) => Math.round(n * 100) === n * 100, {
      message: "Shipping price can have at most 2 decimal places",
    }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;

// ==============================
// Messaging (Phase 1.10)
// ==============================
// A conversation is keyed by orderId (Message.orderId links the order's buyer
// and seller). Real-time WebSocket chat is deferred; the client polls GET
// /api/messages instead (flagged in the route).
export const createMessageSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  content: z.string().trim().min(1, "Message cannot be empty").max(2000),
  imageUrl: z.string().url("imageUrl must be a valid URL").optional().or(z.literal("")),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

// ==============================
// Disputes (Phase 1.10)
// ==============================
// A buyer raises a dispute on an active order; this freezes the seller payout
// pending manual review (admin resolves to refund or release).
export const createDisputeSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  reason: z.string().trim().min(10, "Please describe the problem (min 10 chars)").max(2000),
});

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;

// ==============================
// Ratings & reviews (Phase 1.10)
// ==============================
// Left after a completed (RELEASED) order, by one participant about the other.
export const createRatingSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  score: z.coerce.number().int().min(1, "Score must be 1-5").max(5, "Score must be 1-5"),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type CreateRatingInput = z.infer<typeof createRatingSchema>;

// ==============================
// Admin actions (Phase 2 — RBAC-gated)
// ==============================
// Dispute resolution: an admin either REFUNDS the buyer (order → REFUNDED,
// seller escrow does NOT release) or RELEASES escrow to the seller (order →
// RELEASED, frozen balance → AVAILABLE). Money-critical.
export const resolveDisputeSchema = z.object({
  outcome: z.enum(["refund", "release"], { error: "Choose refund or release" }),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

// Listing moderation: approve a pending listing, reject it, or hide a live one.
export const moderateListingSchema = z.object({
  action: z.enum(["approve", "reject", "hide"], { error: "Invalid action" }),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ModerateListingInput = z.infer<typeof moderateListingSchema>;

// User suspension toggle (trust & safety).
export const suspendUserSchema = z.object({
  suspended: z.boolean(),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

// Admin role assignment / revocation.
export const adminRoleSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  role: z.enum([
    "SUPER_ADMIN",
    "MANAGER",
    "LISTING_VERIFICATION_OFFICER",
    "KYC_REVIEWER",
    "SUPPORT_AGENT",
    "TRUST_AND_SAFETY",
    "MARKETING",
    "SEO_CONTENT",
    "FINANCE",
  ]),
  op: z.enum(["assign", "revoke"]),
});

export type AdminRoleInput = z.infer<typeof adminRoleSchema>;

// ==============================
// Wallet / withdrawal (Phase 2 — KYC-gated payout)
// ==============================
// A seller requests a payout of cleared (AVAILABLE) escrow to their bank. The
// amount is validated as a positive 2-decimal money value here; the KYC gate
// (LEVEL_3 required) and available-balance check are enforced server-side in the
// route via escrow.checkWithdrawalEligibility.
export const withdrawSchema = z.object({
  amount: z.coerce
    .number({ error: "Enter an amount" })
    .positive("Amount must be greater than 0")
    .max(99_999_999.99, "Amount is too large")
    .refine((n) => Math.round(n * 100) === n * 100, {
      message: "Amount can have at most 2 decimal places",
    }),
});

export type WithdrawInput = z.infer<typeof withdrawSchema>;
