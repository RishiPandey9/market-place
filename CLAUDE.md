# CLAUDE.md
### Project instructions for Claude Code — read this before every session

This file is the source of truth for scope, architecture, and constraints. Do not deviate from it without the project owner explicitly changing it first.

---

## Project summary

A **full production-ready** C2C resale marketplace web application (Vinted-style), built solo. Web only — no mobile app. Every user is a single dual-role account (buyer + seller). Built against the Master Scope of Work document, adapted to web-only.

**This is NOT an MVP.** Do not simplify, skip, or stub core money/trust features (escrow, KYC, security, RBAC) to "move faster." If a shortcut is taken for local dev/testing (e.g. Stripe test mode, sandbox KYC), it must be clearly marked and swapped for the production equivalent before launch — never silently left as a permanent simplification.

---

## Hard constraints — do not violate

1. **Web only.** No React Native, no Flutter, no mobile-specific code paths.
2. **No new libraries or services outside the approved stack** (below) without asking first.
3. **No schema changes without updating `/prisma/schema.prisma` and creating a migration.** Never edit the database directly.
4. **Every webhook handler must verify signatures and be idempotent.** No exceptions, no matter how small the feature.
5. **No secrets in code.** All keys come from environment variables, referenced via `/src/lib` clients only — never instantiate SDKs (Stripe, Cloudinary, etc.) inside route handlers or components.
6. **RBAC gates every admin route and admin API handler.** Never expose admin data/actions without a permission check via `/src/lib/rbac.ts`.
7. **Money-related code (wallet, escrow, payouts, refunds) requires a test** before being considered done.
8. **KYC (Level 3 verification) is required before any real withdrawal goes live.** Do not remove or bypass this gate, even temporarily, once real payment keys are in use.
9. **Follow the existing folder structure and API route map** in `technical-foundation.md` — don't invent a different pattern for a new feature; extend the existing one.

---

## Approved tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL (Supabase/Neon) |
| ORM | Prisma |
| Auth | NextAuth.js (Auth.js) |
| Payments/Escrow | Stripe Connect |
| KYC | Veriff / Onfido / Persona (one, TBD) |
| Shipping | Sendcloud / EasyPost / ShipEngine (one, TBD) |
| Media | Cloudinary |
| Search | Algolia or Typesense (Postgres full-text search acceptable as an interim step, must be flagged as interim) |
| Email | SendGrid or Resend |
| SMS/OTP | Twilio |
| Monitoring | Sentry |
| Hosting | Vercel (app) + managed Postgres host |

Do not introduce alternatives to these without discussion — consistency across sessions matters more than marginal technical preference.

---

## Reference files (read before starting work)

- `marketplace-production-plan.md` — full phase-by-phase component checklist. Know which phase current work belongs to.
- `technical-foundation.md` — Prisma schema, `.env.example`, folder structure, API route map. This is the single source of truth for data model and file layout.
- `setup-commands.md` — scaffolding steps already run; don't repeat completed steps.

Before adding a new model, field, or API route: check `technical-foundation.md` first. If it's not there, add it there first, then implement — don't implement ad hoc and let the docs fall out of sync.

---

## How to work each session

1. State which phase and which checklist item(s) from `marketplace-production-plan.md` this session addresses.
2. Reference the relevant section of `technical-foundation.md` (schema models, routes) before writing code.
3. Build one complete, working vertical slice at a time (e.g. "listing creation end to end") rather than scaffolding many incomplete pieces across the app.
4. After finishing a feature, note here (or tell the project owner) which checklist items in `marketplace-production-plan.md` are now complete, so it can be updated.
5. If a request would require violating a hard constraint above, stop and flag it rather than proceeding.

---

## Things explicitly deferred (do not build unless asked)

- Mobile app (Flutter)
- AI-assisted listing / AI search / AI fraud triage (Phase 4)
- Live auction/bidding (Phase 5)
- Multi-market/multi-currency beyond the single launch market
- Live-stream selling

If asked to build one of these early, confirm with the project owner that priorities have changed before proceeding.

---

## Current status

_Update this section as phases complete._

- [ ] Phase 0 — Discovery, legal, architecture
- [x] Phase 1 — Auth, listings, checkout/escrow, shipping, messaging
- [~] Phase 2 — Admin/RBAC, security, compliance (Admin/RBAC + KYC/withdrawal gate done; 2FA, live security hardening pending)
- [ ] Phase 3 — Testing, QA, launch hardening
- [ ] Phase 4 — AI features
- [ ] Phase 5 — Scale
