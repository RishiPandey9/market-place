import { z } from "zod";

import { TICKET_CATEGORIES } from "@/lib/ticket";

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
  // Optional referral code entered at signup or carried via ?ref=. Empty string
  // is coerced to undefined so a blank field is simply "no referral".
  referralCode: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v ? v : undefined)),
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

// ==============================
// Account settings (Phase 3.2)
// ==============================
// Profile: contact + locale fields on the User model. All optional so a user can
// update one field at a time; empty strings clear the nullable columns. `phone`
// is loosely validated here (E.164-ish) — real phone OTP verification is Phase 1.2.
export const updateProfileSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{6,20}$/, "Enter a valid phone number")
      .optional()
      .or(z.literal("")),
    country: z
      .string()
      .trim()
      .length(2, "Use a 2-letter country code")
      .toUpperCase()
      .optional()
      .or(z.literal("")),
    currency: z
      .string()
      .trim()
      .length(3, "Use a 3-letter currency code")
      .toUpperCase()
      .optional()
      .or(z.literal("")),
    language: z
      .string()
      .trim()
      .max(10, "Language code is too long")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Password change: verify the current password server-side, then set a new one
// that meets the shared strength rules. `newPassword` must differ from current.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current one",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Address book: reuse the shipping address shape and add an isDefault flag.
export const createAddressSchema = shippingAddressSchema.extend({
  isDefault: z.boolean().optional().default(false),
});

export const updateAddressSchema = z
  .object({
    line1: shippingAddressSchema.shape.line1.optional(),
    line2: shippingAddressSchema.shape.line2,
    city: shippingAddressSchema.shape.city.optional(),
    postalCode: shippingAddressSchema.shape.postalCode.optional(),
    country: shippingAddressSchema.shape.country.optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

// Notification preferences: coarse per-channel opt-ins. All optional so a single
// toggle can be flipped; the route upserts the row with defaults for the rest.
export const notificationPreferencesSchema = z
  .object({
    emailOrders: z.boolean().optional(),
    emailMessages: z.boolean().optional(),
    emailMarketing: z.boolean().optional(),
    pushOrders: z.boolean().optional(),
    pushMessages: z.boolean().optional(),
    pushMarketing: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No preferences to update",
  });

export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesSchema
>;

// ==============================
// Support tickets (Phase 3.3)
// ==============================

// Open a new ticket: subject + category + the first message body.
export const createTicketSchema = z.object({
  subject: z.string().trim().min(4, "Subject is too short").max(140),
  category: z.enum(TICKET_CATEGORIES),
  message: z.string().trim().min(1, "Message is required").max(4000),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

// Post a reply to an existing ticket (user or agent).
export const ticketReplySchema = z.object({
  body: z.string().trim().min(1, "Message is required").max(4000),
});

export type TicketReplyInput = z.infer<typeof ticketReplySchema>;

// Agent-only explicit status change. Reply-driven transitions are handled
// separately; this is for "resolve"/"close"/"reopen" buttons.
export const ticketStatusSchema = z.object({
  status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]),
});

export type TicketStatusInput = z.infer<typeof ticketStatusSchema>;

// ==============================
// Social — follow a seller (SOW §02/§04)
// ==============================
export const followSchema = z.object({
  sellerId: z.string().min(1, "sellerId is required"),
  follow: z.boolean(),
});
export type FollowInput = z.infer<typeof followSchema>;

// ==============================
// Bank accounts — seller payout details (SOW §05/§08)
// ==============================
// Only tokenized / display fields are ever accepted here. A raw IBAN or full
// account number must NEVER be posted to or stored by the app (PCI/data-at-rest,
// CLAUDE.md #5) — the real external account lives with Stripe Connect. `last4`
// is display-only and `providerAccountId` is the Stripe external-account token.
export const createBankAccountSchema = z.object({
  label: z.string().trim().max(60).optional().or(z.literal("")),
  holderName: z.string().trim().min(2, "Account holder name is required").max(120),
  country: z.string().trim().length(2, "Use a 2-letter country code").toUpperCase(),
  currency: z.string().trim().length(3, "Use a 3-letter currency code").toUpperCase(),
  last4: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits"),
  providerAccountId: z.string().trim().max(255).optional().or(z.literal("")),
  isDefault: z.boolean().optional().default(false),
});
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;

// ==============================
// Payment methods — buyer cards/wallets (SOW §05)
// ==============================
// Card data is NEVER accepted or stored (PCI-DSS). The client tokenizes the card
// with Stripe.js and posts only the resulting PaymentMethod id plus the safe
// display metadata Stripe returns (brand + last4 + expiry).
export const createPaymentMethodSchema = z.object({
  providerMethodId: z
    .string()
    .trim()
    .min(3, "A tokenized payment method id is required")
    .max(255),
  brand: z.string().trim().max(40).optional().or(z.literal("")),
  last4: z.string().trim().regex(/^\d{4}$/, "last4 must be 4 digits").optional().or(z.literal("")),
  expMonth: z.coerce.number().int().min(1).max(12).optional(),
  expYear: z.coerce.number().int().min(2000).max(2100).optional(),
  isDefault: z.boolean().optional().default(false),
});
export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;

// ==============================
// Offers — buyer negotiation on a listing (SOW §02)
// ==============================
const offerAmount = z.coerce
  .number({ error: "Enter an offer amount" })
  .positive("Offer must be greater than 0")
  .max(99_999_999.99, "Offer is too large")
  .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, {
    message: "Offer can have at most 2 decimal places",
  });

// Buyer opens an offer on a listing.
export const createOfferSchema = z.object({
  amount: offerAmount,
  message: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateOfferInput = z.infer<typeof createOfferSchema>;

// Seller/buyer act on an existing offer. "counter" requires an amount.
export const offerActionSchema = z
  .object({
    action: z.enum(["accept", "decline", "counter", "withdraw"]),
    amount: offerAmount.optional(),
    message: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((v) => v.action !== "counter" || v.amount !== undefined, {
    message: "A counter-offer needs an amount",
    path: ["amount"],
  });
export type OfferActionInput = z.infer<typeof offerActionSchema>;

// ==============================
// Bundles — group same-seller listings to ship together (SOW §09)
// ==============================
export const createBundleSchema = z.object({
  listingIds: z
    .array(z.string().min(1))
    .min(2, "A bundle needs at least 2 items")
    .max(20, "A bundle can hold at most 20 items"),
});
export type CreateBundleInput = z.infer<typeof createBundleSchema>;

// ==============================
// Listing promotion — paid bump/spotlight (SOW §05)
// ==============================
export const promoteListingSchema = z.object({
  type: z.enum(["BUMP", "SPOTLIGHT"]),
  days: z.coerce.number().int().min(1, "Minimum 1 day").max(30, "Maximum 30 days"),
});
export type PromoteListingInput = z.infer<typeof promoteListingSchema>;

// ==============================
// Admin — marketing campaigns (SOW §05/§06)
// ==============================
export const campaignSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  type: z.enum(["BANNER", "FEATURED", "EMAIL"]),
  active: z.boolean().optional().default(false),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  // Free-form per-type config (image url, target url, listing ids, etc.).
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

// ==============================
// Admin — CMS / SEO content (SOW §05/§06)
// ==============================
export const contentPageSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a url-safe slug (lowercase, dashes)")
    .max(140),
  title: z.string().trim().min(2, "Title is required").max(200),
  body: z.string().trim().min(1, "Body is required").max(100_000),
  isBlog: z.boolean().optional().default(false),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional().default("DRAFT"),
  metaTitle: z.string().trim().max(200).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(320).optional().or(z.literal("")),
});
export type ContentPageInput = z.infer<typeof contentPageSchema>;
