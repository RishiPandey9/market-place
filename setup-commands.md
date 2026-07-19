# Project Scaffolding — Commands & Claude Code Prompts
Run these in order. Terminal commands go in your shell; "Claude Code prompt" blocks are text you paste directly to Claude Code.

---

## Step 1 — Create accounts (manual, before any code)

Do this first — you'll need real keys for `.env` in Step 4.

1. Vercel account (deploy target)
2. Supabase or Neon account (PostgreSQL)
3. Stripe account → enable Connect in dashboard
4. Cloudinary account
5. KYC provider account (Veriff/Onfido/Persona) — free sandbox to start
6. Shipping aggregator account (Sendcloud/EasyPost/ShipEngine) — sandbox mode
7. SendGrid or Resend account
8. Twilio account
9. Sentry account
10. Algolia or Typesense account (can defer to Phase 1.6 if you want to launch search later)

---

## Step 2 — Initialize the repo

```bash
mkdir marketplace-app && cd marketplace-app
git init
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"
```

When prompted, accept defaults (App Router: yes, src directory: yes).

```bash
git add -A
git commit -m "Initial Next.js scaffold"
```

---

## Step 3 — Install core dependencies

```bash
npm install prisma @prisma/client
npm install next-auth @auth/prisma-adapter
npm install stripe
npm install cloudinary
npm install @sendgrid/mail
npm install twilio
npm install @sentry/nextjs
npm install zod
npm install bcryptjs
npm install date-fns

npm install -D @types/bcryptjs
```

---

## Step 4 — Set up environment variables

```bash
touch .env.local
```

Paste the contents of `technical-foundation.md` Section 2 (`.env.example`) into `.env.local`, then fill in real keys from Step 1's accounts (use **test/sandbox keys only** at this stage — never live keys during setup).

```bash
echo ".env.local" >> .gitignore
git add .gitignore
git commit -m "Add gitignore for env file"
```

---

## Step 5 — Initialize Prisma

```bash
npx prisma init
```

This creates `/prisma/schema.prisma`. Replace its contents with the schema from `technical-foundation.md` Section 1.

Then:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

This creates your database tables and generates the Prisma client.

---

## Step 6 — First Claude Code prompt: project setup verification

```
Claude Code prompt:

I'm building a C2C resale marketplace web app (Next.js App Router, TypeScript,
Tailwind, Prisma, PostgreSQL). I've just scaffolded the project and initialized
Prisma with a schema covering User, Listing, Order, WalletTransaction, Dispute,
Message, Rating, VerificationRecord, AdminRoleAssignment, AuditLog, Notification,
Address, Category, Favorite, SavedSearch models.

Please:
1. Create a Prisma client singleton at /src/lib/db.ts (avoid multiple instances
   in dev mode with Next.js hot reload).
2. Verify the schema I've added compiles cleanly and run `npx prisma validate`.
3. Create a /prisma/seed.ts file that seeds: 3 test users, 5 categories
   (Women, Men, Kids, Designer, Electronics), 10 test listings across sellers,
   and wire it into package.json so `npx prisma db seed` works.

Reference the full schema in /prisma/schema.prisma before making changes.
```

---

## Step 7 — Claude Code prompt: auth setup

```
Claude Code prompt:

Set up NextAuth.js (Auth.js) for this project with:
1. Email/password credentials provider, using bcryptjs to hash/compare
   passwords against the User.passwordHash field in Prisma.
2. Google OAuth provider (env vars GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
   already in .env.local).
3. Prisma adapter so sessions/accounts are stored in the database.
4. JWT session strategy with short-lived access token and refresh handling.
5. A /src/lib/auth.ts config file, and the API route at
   /src/app/api/auth/[...nextauth]/route.ts.
6. Basic signup page at /src/app/(public)/signup/page.tsx and login page at
   /src/app/(public)/login/page.tsx using Tailwind, following the folder
   structure in technical-foundation.md.

Do not implement social Apple/Facebook login yet — just Google + credentials
for now. Make sure passwords are never logged or returned in API responses.
```

---

## Step 8 — Claude Code prompt: Stripe Connect setup

```
Claude Code prompt:

Set up Stripe integration for marketplace escrow:
1. Create /src/lib/stripe.ts initializing the Stripe client with
   STRIPE_SECRET_KEY from env — this should be the only place Stripe is
   instantiated.
2. Create an API route /src/app/api/stripe/connect-onboard/route.ts that
   creates a Stripe Connect Express account for a seller (User.stripeAccountId)
   and returns an onboarding link.
3. Create the webhook handler /src/app/api/webhooks/stripe/route.ts that:
   - Verifies the Stripe signature using STRIPE_WEBHOOK_SECRET
   - Handles payment_intent.succeeded (mark Order as PAID, create
     WalletTransaction in PENDING state)
   - Handles account.updated (mark seller verification complete when Connect
     onboarding finishes)
   - Is idempotent — check if the event was already processed before acting
4. Add a basic test in /tests/webhooks.test.ts that mocks a Stripe webhook
   payload and asserts the order status updates correctly.

Reference the Order and WalletTransaction models in /prisma/schema.prisma.
Do not build the checkout UI yet — just the backend Stripe plumbing.
```

---

## Step 9 — Deploy the empty scaffold immediately

```bash
git add -A
git commit -m "Auth + Stripe scaffolding"
npx vercel login
npx vercel
```

Follow the prompts to link the project. Add all `.env.local` variables to the Vercel project settings (Environment Variables) before the first real deploy.

```bash
npx vercel --prod
```

Confirm you have a live URL before moving to Phase 1 feature work — this validates your whole pipeline (build, env vars, database connection) works end to end.

---

## Step 10 — Ongoing Claude Code session pattern

For every new feature going forward, structure your prompt like this:

```
Claude Code prompt template:

I'm working on [feature name] from Phase [X] of my build plan.
Reference /prisma/schema.prisma for the data model and
technical-foundation.md for folder structure and API routes.

Build: [specific feature, e.g. "the add-listing form and API route"]

Requirements:
- [specific requirement 1]
- [specific requirement 2]
- Follow existing patterns in /src/lib and /src/app/api
- Add a test if it touches money, escrow, or auth logic
```

This keeps every session grounded in the same schema and structure instead of Claude Code improvising a different pattern each time.

---

## Order of feature-building prompts (Phase 1, in sequence)

1. Listing CRUD (create, edit, view, my-listings page)
2. Category browse + Postgres/Algolia search integration
3. Checkout flow (address, shipping rate fetch, Stripe payment)
4. Order state machine + wallet state updates
5. Shipping label generation + tracking webhook handler
6. Messaging (start with polling, no WebSockets yet)
7. Dispute flow
8. Ratings
9. Admin panel (basic: users, listings, orders, disputes)
10. KYC integration (Level 3 verification) — gate withdrawal on this before going live with real payouts
