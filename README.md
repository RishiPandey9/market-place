# Reloved — C2C Resale Marketplace

A production-grade, Vinted-style peer-to-peer resale marketplace. Web only. Every
account is a single **dual-role** identity (buyer **and** seller). Built with
Next.js (App Router) + TypeScript, Prisma/PostgreSQL, NextAuth, Stripe Connect
escrow, KYC verification, and a full RBAC-gated admin console.

> **This is a staging / showcase build.** The demo data below is safe for a
> staging environment with test/sandbox keys. It is **not** for a live
> production launch — see `CLAUDE.md` for the hard constraints (KYC gate, money
> tests, security hardening) that must be satisfied before going live.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma |
| Auth | NextAuth.js (JWT sessions) |
| Payments / Escrow | Stripe Connect |
| Media | Cloudinary |
| Email / SMS | SendGrid / Twilio |

---

## Quick start (local)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#   then fill in DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, etc.

# 3. Apply the schema
npx prisma migrate deploy

# 4. Seed base data (categories + a few users/listings) THEN demo/showcase data
npm run db:seed          # base categories + alice/bob/carol + base listings
npm run db:seed:demo     # named demo customers, 9 section admins, orders, etc.

# 5. Run
npm run dev              # http://localhost:3000
```

> **Seed order matters.** Run `db:seed` **before** `db:seed:demo`. The demo seed
> reuses the base-seed categories (`seed-cat-*`) and references base users, so the
> base seed must exist first. Both seeds are **idempotent** (pinned IDs + upsert) —
> safe to re-run.

---

## Demo accounts

All demo accounts are created by `npm run db:seed:demo`. Log in at **`/login`**.

### Customers — password: `Demo1234!`

| Email | Role focus | What it showcases |
|---|---|---|
| `demo.buyer@reloved.app` | Buyer-heavy | Multiple orders across the escrow lifecycle (paid, shipped, delivered, released, **disputed**), saved address & card (Visa ••4242), favourites, follows, a pending **offer**, referral code `EMMA-2026`, notifications. Verification: **Level 1 (basic)**. |
| `demo.seller@reloved.app` | Seller-heavy | 7 listings across every state (active, sold, **pending review**, hidden/flagged), completed sales with earnings, **wallet** balance (available + pending), a verified bank account, a **withdrawal** request, a submitted **KYC** record, a 5-star rating, referral code `JAMES-2026`. Verification: **Level 3 (ID verified)** — withdrawal-eligible. |

Between them these two accounts exercise the full buyer↔seller flow: `demo.buyer`
purchased from `demo.seller`, and one of those orders is **disputed** (visible to
both sides and to the Trust & Safety admin).

### Admins — password: `Admin1234!`

One admin per RBAC section so each console area has an account scoped to exactly
its permissions. Log in at `/login`, then go to **`/admin`**. Each admin only
sees (and can only reach) the sections their role permits — trying another
section redirects to the admin dashboard.

| Email | Role | Console sections it can show |
|---|---|---|
| `admin.super@reloved.app` | `SUPER_ADMIN` | **Everything** — the full console (use this for a complete walkthrough) |
| `admin.manager@reloved.app` | `MANAGER` | Broad operational oversight across sections |
| `admin.listings@reloved.app` | `LISTING_VERIFICATION_OFFICER` | Listing moderation queue — approve/reject pending listings, review the flagged/hidden one |
| `admin.kyc@reloved.app` | `KYC_REVIEWER` | Verification queue — review submitted KYC / identity records |
| `admin.support@reloved.app` | `SUPPORT_AGENT` | Support tickets — respond to the open shipping ticket |
| `admin.safety@reloved.app` | `TRUST_AND_SAFETY` | Disputes — the under-review dispute on the buyer/seller order |
| `admin.marketing@reloved.app` | `MARKETING` | Campaigns — the "Summer Pre-Loved Sale" banner campaign |
| `admin.seo@reloved.app` | `SEO_CONTENT` | CMS / content pages — the published "How Buyer Protection Works" page |
| `admin.finance@reloved.app` | `FINANCE` | Finance — wallet balances, the pending withdrawal, payout/escrow ledger |

### Base-seed users — password: `Password123!`

Created by `npm run db:seed` (plain fixtures, minimal data):
`alice@example.com`, `bob@example.com`, `carol@example.com`.

---

## Suggested showcase walkthrough

1. **Buyer experience** — log in as `demo.buyer@reloved.app`. Browse the
   dashboard, open **Orders** to see the escrow states, view the **disputed**
   order, check **Offers**, **Favourites**, and **Referrals** (`EMMA-2026`).
2. **Seller experience** — log in as `demo.seller@reloved.app`. Open **My
   listings** (active / sold / pending / hidden), **Wallet** (available +
   pending balance), and the **Withdrawal** request. Note the **Level 3**
   verified badge.
3. **Admin console** — log in as `admin.super@reloved.app` for the full tour, or
   use a section admin above to demo scoped access. Show the **listing
   moderation queue**, **KYC/verification queue**, **disputes**, **support
   tickets**, **finance/withdrawals**, **marketing campaign**, and **CMS page**.

---

## Seeding reference

| Command | What it creates |
|---|---|
| `npm run db:seed` | Categories, base users (alice/bob/carol), base listings — **run first** |
| `npm run db:seed:demo` | Named demo customers, 9 section admins, orders across the escrow lifecycle, dispute, ticket, withdrawal, KYC record, campaign, CMS page — **run second** |

Both seeds are idempotent; re-running updates rows in place.

---

## Security & scope notes

- **No secrets in code.** All keys come from environment variables (`.env.local`,
  never committed). Only `.env.example` (placeholders) is tracked.
- Demo passwords above are for **staging/showcase only**. Rotate or remove demo
  accounts before any real launch.
- See **`CLAUDE.md`** for the full project constraints, approved stack, and the
  phase-by-phase status. See **`technical-foundation.md`** for the schema and API
  route map, and **`marketplace-production-plan.md`** for the component checklist.
