# Technical Foundation
### Prisma schema, environment variables, folder structure & API route map
Reference this file in every Claude Code session so structure and naming stay consistent across the whole build.

---

## 1. Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ==============================
// ENUMS
// ==============================

enum VerificationLevel {
  LEVEL_1_BASIC
  LEVEL_2_SELLER
  LEVEL_3_ID_VERIFIED
}

enum ListingStatus {
  DRAFT
  PENDING_REVIEW
  ACTIVE
  RESERVED
  SOLD
  HIDDEN
  REJECTED
}

enum OrderStatus {
  PENDING_PAYMENT
  PAID
  SHIPPED
  DELIVERED
  RELEASED
  DISPUTED
  REFUNDED
  CANCELLED
}

enum WalletState {
  PENDING
  AVAILABLE
  WITHDRAWN
  FROZEN
}

enum DisputeStatus {
  OPEN
  UNDER_REVIEW
  RESOLVED_REFUND
  RESOLVED_RELEASE
  CLOSED
}

enum AdminRole {
  SUPER_ADMIN
  MANAGER
  LISTING_VERIFICATION_OFFICER
  KYC_REVIEWER
  SUPPORT_AGENT
  TRUST_AND_SAFETY
  MARKETING
  SEO_CONTENT
  FINANCE
}

enum NotificationChannel {
  EMAIL
  PUSH
  SMS
}

// ==============================
// CORE MODELS
// ==============================

model User {
  id                  String             @id @default(cuid())
  email               String             @unique
  passwordHash        String?
  phone               String?
  phoneVerified       Boolean            @default(false)
  emailVerified       Boolean            @default(false)
  verificationLevel   VerificationLevel  @default(LEVEL_1_BASIC)
  stripeAccountId     String?            // Stripe Connect account id (seller payouts)
  stripeCustomerId    String?            // Stripe customer id (buyer payments)
  twoFactorEnabled    Boolean            @default(false)
  suspended           Boolean            @default(false)
  suspendedAt         DateTime?
  country             String?
  currency             String?
  language             String?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  addresses           Address[]
  listings            Listing[]          @relation("SellerListings")
  ordersAsBuyer       Order[]            @relation("BuyerOrders")
  ordersAsSeller      Order[]            @relation("SellerOrders")
  walletTransactions  WalletTransaction[]
  messagesSent        Message[]          @relation("MessageSender")
  ratingsGiven        Rating[]           @relation("RatingAuthor")
  ratingsReceived     Rating[]           @relation("RatingTarget")
  notifications       Notification[]
  adminRoles          AdminRoleAssignment[]
  auditLogs           AuditLog[]
}

model Address {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  line1       String
  line2       String?
  city        String
  postalCode  String
  country     String
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model Category {
  id        String     @id @default(cuid())
  name      String
  parentId  String?
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  listings  Listing[]
}

model Listing {
  id            String        @id @default(cuid())
  sellerId      String
  seller        User          @relation("SellerListings", fields: [sellerId], references: [id])
  title         String
  description   String
  categoryId    String
  category      Category      @relation(fields: [categoryId], references: [id])
  brand         String?
  size          String?
  condition     String?
  color         String?
  price         Decimal       @db.Decimal(10, 2)
  currency      String
  parcelSize    String        // e.g. small/medium/large/custom
  images        String[]      // CDN urls
  status        ListingStatus @default(DRAFT)
  country       String
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  orders        Order[]
  favorites     Favorite[]
}

model Favorite {
  id        String   @id @default(cuid())
  userId    String
  listingId String
  listing   Listing  @relation(fields: [listingId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, listingId])
}

model SavedSearch {
  id        String   @id @default(cuid())
  userId    String
  query     String
  filters   Json
  createdAt DateTime @default(now())
}

model Order {
  id                String      @id @default(cuid())
  buyerId           String
  buyer             User        @relation("BuyerOrders", fields: [buyerId], references: [id])
  sellerId          String
  seller            User        @relation("SellerOrders", fields: [sellerId], references: [id])
  listingId         String
  listing           Listing     @relation(fields: [listingId], references: [id])
  status            OrderStatus @default(PENDING_PAYMENT)

  itemPrice         Decimal     @db.Decimal(10, 2)
  shippingPrice     Decimal     @db.Decimal(10, 2)
  protectionFee     Decimal     @db.Decimal(10, 2)
  totalPrice        Decimal     @db.Decimal(10, 2)
  currency          String

  stripePaymentIntentId String?
  shippingCarrier   String?
  trackingNumber    String?
  labelUrl          String?
  shippedAt         DateTime?
  deliveredAt       DateTime?
  autoConfirmAt     DateTime?   // delivery + confirm window
  releasedAt        DateTime?

  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  walletTransactions WalletTransaction[]
  dispute           Dispute?
  messages          Message[]
  ratings           Rating[]
}

model WalletTransaction {
  id        String      @id @default(cuid())
  userId    String
  user      User        @relation(fields: [userId], references: [id])
  orderId   String
  order     Order       @relation(fields: [orderId], references: [id])
  amount    Decimal     @db.Decimal(10, 2)
  currency  String
  state     WalletState @default(PENDING)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
}

model Dispute {
  id          String        @id @default(cuid())
  orderId     String        @unique
  order       Order         @relation(fields: [orderId], references: [id])
  raisedById  String
  reason      String
  status      DisputeStatus @default(OPEN)
  resolution  String?
  createdAt   DateTime      @default(now())
  resolvedAt  DateTime?
}

model Message {
  id        String   @id @default(cuid())
  orderId   String?
  order     Order?   @relation(fields: [orderId], references: [id])
  senderId  String
  sender    User     @relation("MessageSender", fields: [senderId], references: [id])
  content   String
  imageUrl  String?
  createdAt DateTime @default(now())
}

model Rating {
  id          String   @id @default(cuid())
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id])
  authorId    String
  author      User     @relation("RatingAuthor", fields: [authorId], references: [id])
  targetId    String
  target      User     @relation("RatingTarget", fields: [targetId], references: [id])
  score       Int      // 1-5
  comment     String?
  createdAt   DateTime @default(now())
}

model VerificationRecord {
  id            String   @id @default(cuid())
  userId        String
  provider      String   // e.g. "veriff", "onfido"
  providerRefId String
  status        String   // pending/approved/rejected
  createdAt     DateTime @default(now())
}

model AdminRoleAssignment {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  role      AdminRole
  createdAt DateTime  @default(now())

  @@unique([userId, role])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  action    String
  metadata  Json?
  createdAt DateTime @default(now())
}

model Notification {
  id        String              @id @default(cuid())
  userId    String
  user      User                @relation(fields: [userId], references: [id])
  channel   NotificationChannel
  title     String
  body      String
  read      Boolean             @default(false)
  createdAt DateTime            @default(now())
}
```

---

## 2. Environment Variables (`.env.example`)

```bash
# Database
DATABASE_URL=

# Auth (NextAuth.js)
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_CLIENT_ID=

# KYC provider (choose one)
KYC_PROVIDER_API_KEY=
KYC_PROVIDER_WEBHOOK_SECRET=

# Shipping aggregator
SHIPPING_API_KEY=
SHIPPING_API_SECRET=

# Cloudinary (media storage/CDN)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Search (Algolia/Typesense)
SEARCH_APP_ID=
SEARCH_API_KEY=
SEARCH_INDEX_NAME=

# Email
SENDGRID_API_KEY=
EMAIL_FROM_ADDRESS=

# SMS/OTP
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Monitoring
SENTRY_DSN=

# App config
APP_URL=
DEFAULT_CURRENCY=
DEFAULT_COUNTRY=
```

---

## 3. Folder Structure

```
/app
  /(public)
    /page.tsx                  → landing page
    /login/page.tsx
    /signup/page.tsx
    /forgot-password/page.tsx
  /(dashboard)
    /feed/page.tsx              → home feed
    /category/[slug]/page.tsx
    /search/page.tsx
    /listing/[id]/page.tsx
    /seller/[id]/page.tsx
    /favorites/page.tsx
    /saved-searches/page.tsx
    /listings/new/page.tsx      → add listing
    /listings/[id]/edit/page.tsx
    /my-listings/page.tsx
    /orders/page.tsx            → my orders (buyer)
    /sales/page.tsx             → my sales (seller)
    /orders/[id]/page.tsx       → order detail + tracking
    /messages/page.tsx
    /messages/[conversationId]/page.tsx
    /wallet/page.tsx
    /wallet/withdraw/page.tsx
    /settings/profile/page.tsx
    /settings/security/page.tsx
    /settings/addresses/page.tsx
    /settings/notifications/page.tsx
    /verification/page.tsx      → KYC flow
  /admin
    /dashboard/page.tsx
    /users/page.tsx
    /listings/page.tsx          → moderation queue
    /orders/page.tsx
    /disputes/page.tsx
    /verification-queue/page.tsx
    /analytics/page.tsx
    /roles/page.tsx
  /api
    /auth/[...nextauth]/route.ts
    /listings/route.ts
    /listings/[id]/route.ts
    /orders/route.ts
    /orders/[id]/route.ts
    /orders/[id]/ship/route.ts
    /orders/[id]/confirm/route.ts
    /wallet/withdraw/route.ts
    /verification/route.ts
    /messages/route.ts
    /disputes/route.ts
    /webhooks/stripe/route.ts
    /webhooks/shipping/route.ts
    /webhooks/kyc/route.ts
    /search/route.ts
    /upload/route.ts

/lib
  /db.ts                        → Prisma client singleton
  /auth.ts                      → NextAuth config
  /stripe.ts                    → Stripe client + helper functions
  /shipping.ts                  → carrier aggregator client
  /kyc.ts                       → KYC provider client
  /cloudinary.ts
  /search.ts
  /email.ts
  /sms.ts
  /rbac.ts                      → permission checks per AdminRole

/components
  /ui/                          → shared buttons, inputs, modals
  /listing/                     → listing card, form, gallery
  /checkout/                    → shipping selector, payment form
  /wallet/                      → balance card, transaction list
  /admin/                       → admin tables, moderation widgets

/prisma
  /schema.prisma
  /migrations/
  /seed.ts

/tests
  /wallet.test.ts
  /escrow.test.ts
  /webhooks.test.ts
```

---

## 4. API Route Map

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/[...nextauth]` | Login/session (NextAuth) |
| POST | `/api/auth/register` | Email/password signup (bcrypt hash, creates User) |
| POST | `/api/stripe/connect-onboard` | Create/refresh seller Stripe Connect account + onboarding link |
| POST | `/api/listings` | Create listing |
| GET | `/api/listings/[id]` | Get listing detail |
| PATCH | `/api/listings/[id]` | Edit listing |
| DELETE | `/api/listings/[id]` | Remove/hide listing |
| GET | `/api/search` | Search listings (query + filters) |
| POST | `/api/upload` | Upload image to Cloudinary |
| POST | `/api/orders` | Create order (checkout) |
| GET | `/api/orders/[id]` | Order detail + tracking |
| POST | `/api/orders/[id]/ship` | Seller marks shipped, generates label |
| POST | `/api/orders/[id]/confirm` | Buyer confirms delivery |
| POST | `/api/wallet/withdraw` | Request payout to bank. KYC-gated (Level 3). Money-critical. |
| POST | `/api/verification` | Start KYC (Level 3) identity verification for the signed-in user; returns provider redirect. |
| POST | `/api/messages` | Send message |
| POST | `/api/disputes` | Raise a dispute |
| POST | `/api/admin/disputes/[id]/resolve` | Admin resolves a dispute (refund or release escrow). RBAC: `disputes.resolve`. Money-critical. |
| PATCH | `/api/admin/listings/[id]` | Admin moderates a listing (approve/reject/hide). RBAC: `listings.moderate`. |
| PATCH | `/api/admin/users/[id]` | Admin suspends/reactivates a user. RBAC: `users.manage`. |
| POST | `/api/admin/roles` | Admin assigns/revokes an admin role. RBAC: `roles.manage`. |
| POST | `/api/webhooks/stripe` | Stripe event handler (payment, payout events) |
| POST | `/api/webhooks/shipping` | Carrier tracking event handler |
| POST | `/api/webhooks/kyc` | KYC provider verification result handler |

---

## Notes for Claude Code sessions
- Always reference this file's schema and route map before adding new models or endpoints — extend it here first, then implement.
- Webhook routes (`/api/webhooks/*`) must verify signatures and be idempotent — no exceptions.
- Keep `/lib` files as the only place external SDKs (Stripe, Cloudinary, etc.) are initialized — don't instantiate clients inside route handlers.
- RBAC checks (`/lib/rbac.ts`) must gate every `/admin` route and API handler that touches user/order/listing data at the admin level.

---

## Decisions log (deviations from first-draft plan, with rationale)

- **Auth uses JWT sessions without the Prisma/DB adapter.** The Auth.js `@auth/prisma-adapter` requires `emailVerified` to be a `DateTime?` and adds `Account`/`Session`/`VerificationToken` tables — both conflict with this schema (`emailVerified Boolean`, no session tables). To keep the documented schema authoritative, NextAuth runs with `session.strategy = "jwt"`, a Credentials provider (bcrypt vs `User.passwordHash`), and Google OAuth. Google sign-ins are upserted into `User` by email inside the `signIn`/`jwt` callbacks. No schema change, no migration needed. Revisit if we later need server-side session revocation lists.
- **Prisma pinned to v6.19.3** (not v7). Prisma 7 removed `url = env("DATABASE_URL")` from the `datasource` block in favour of `prisma.config.ts` + driver adapters, which would require rewriting the Section 1 schema. Pinned v6 keeps the documented schema valid as written.
- **`tsx`** added as a dev dependency solely to run the TypeScript `prisma/seed.ts` via `prisma db seed` (the Prisma-standard seed runner).
- **Supabase two-URL datasource.** Per Supabase's official Prisma guide, `datasource db` uses `url = env("DATABASE_URL")` (transaction pooler, port 6543, `pgbouncer=true`) for the app and `directUrl = env("DIRECT_URL")` (session pooler, port 5432) for migrations — Prisma migrate cannot run through pgbouncer. Both `DATABASE_URL` and `DIRECT_URL` must be present in `.env` (CLI/migrations) and `.env.local` (runtime).
