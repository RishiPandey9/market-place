# Global Resale Marketplace — Web Production Build Plan
### Full component breakdown by phase (solo build with Claude Code)

---

## PHASE 0 — Discovery, Legal & Architecture

### 0.1 Business & legal setup
- [ ] Confirm launch market (single country)
- [ ] Confirm niche focus (e.g. designer resale)
- [ ] Register business entity if not already done
- [ ] Consult adviser: money-holding/escrow obligations in launch market
- [ ] Consult adviser: tax reporting obligations (DAC7 / 1099-K / HMRC, as applicable)
- [ ] Draft Terms of Service, Privacy Policy, Buyer Protection Policy, Seller Agreement

### 0.2 Third-party account setup (client-owned, per SOW Section 16)
- [ ] Stripe Connect (payments + escrow + payouts + KYC option)
- [ ] KYC/ID verification provider (Veriff / Onfido / Persona)
- [ ] Shipping aggregator (Sendcloud / EasyPost / ShipEngine)
- [ ] Tax compliance tool (Stripe Tax / Avalara / TaxJar)
- [ ] Hosting provider (DigitalOcean / AWS)
- [ ] Managed PostgreSQL with HA
- [ ] Object storage + CDN (Cloudinary or S3 + CloudFront)
- [ ] Search service (Algolia / Typesense)
- [ ] Email service (SendGrid / Postmark)
- [ ] SMS/OTP service (Twilio)
- [ ] Push/web notifications
- [ ] Error monitoring (Sentry) + uptime monitoring
- [ ] Domain + SSL
- [ ] Vercel or equivalent for Next.js deploys

### 0.3 Architecture & environments
- [ ] Repo created, branching strategy defined
- [ ] Three environments: dev, staging, production
- [ ] CI/CD pipeline (auto-deploy from branches, rollback capability)
- [ ] Secrets management (vault/environment variables, never in code)
- [ ] Decide backend approach: Next.js API routes vs. separate NestJS service

### 0.4 Design
- [ ] Design system (colors, typography, components)
- [ ] Wireframes for full screen inventory (web versions of all screens in SOW Section 05)
- [ ] User flow diagrams: registration → listing → checkout → escrow → payout → dispute

### 0.5 Data model
- [ ] Full Prisma schema drafted: User, Listing, Order, WalletTransaction, Dispute, Message, VerificationRecord, AdminRole, AuditLog, Category, Address, Rating, Notification
- [ ] Migrations written and tested
- [ ] Seed data for local testing

---

## PHASE 1 — Core Build: Auth & Identity

### 1.1 Registration & login
- [ ] Email/password signup
- [ ] Social OAuth: Google, Apple, Facebook
- [ ] IP-based country auto-detection, confirmed by user address
- [ ] Locale/currency/language set on registration

### 1.2 Verification tiers
- [ ] Level 1: Email + phone OTP verification (required to browse/buy)
- [ ] Level 2: Payout method connected + profile complete (required to sell)
- [x] Level 3: Government-ID scan + selfie/liveness via KYC provider (required to withdraw) — sandbox-gated; live provider TBD
- [ ] Visible trust badges (email, phone, ID, payment verified)
- [ ] Selling/withdrawal limits tied to verification tier

### 1.3 Auth security architecture
- [ ] JWT access tokens (short-lived) + refresh token rotation
- [ ] Password hashing: bcrypt or argon2
- [ ] Password strength rules enforced
- [ ] Two-factor authentication (2FA) for login and withdrawals
- [ ] Session management: device tracking, remote logout, suspicious-login detection
- [ ] Audit log of auth events

---

## PHASE 1 — Core Build: Listings & Catalog

### 1.4 Listing creation
- [ ] Multi-image upload (camera/gallery on web), auto-compression, CDN storage
- [ ] Title, description, category tree, brand, size, condition, color fields
- [ ] Price in local currency + parcel size/weight tier
- [ ] Publish flow, tagged with seller country

### 1.5 Listing management
- [ ] Edit listing (all fields)
- [ ] Mark sold / reserved / hidden
- [ ] "My listings" / closet view
- [ ] Listing verification queue (flagged/high-risk items held for manual review)

### 1.6 Discovery
- [ ] Category tree + brand pages
- [ ] Search integration (Algolia/Typesense) with filters: size, brand, condition, price, color
- [ ] Sort options
- [ ] Personalized home feed (recency + relevance weighting)
- [ ] Favorites/likes
- [ ] Follow-seller
- [ ] Saved searches with alerts

---

## PHASE 1 — Core Build: Orders, Checkout & Escrow

### 1.7 Checkout flow
- [ ] Address entry + validation
- [ ] Live shipping rate fetch from carrier aggregator
- [ ] Buyer selects shipping option (price/speed tradeoff)
- [ ] Payment: item + shipping + buyer-protection fee via Stripe Connect
- [ ] Order confirmation screen

### 1.8 Escrow & wallet
- [ ] Stripe Connect seller onboarding (connected accounts)
- [ ] Funds captured and held (escrow), not released to seller yet
- [ ] Webhook handler for Stripe events — signature verification, idempotency
- [ ] Order state machine: paid → shipped → delivered → released
- [ ] Wallet states: pending, available, withdrawn, frozen (dispute)
- [ ] Auto-confirm timer post-delivery (configurable window)
- [x] Withdrawal flow to verified bank account (gated by KYC) — sandbox payout; 2FA + real Stripe payout TBD before launch
- [ ] Transaction history view

### 1.9 Shipping & fulfilment
- [ ] Carrier aggregator integration: label generation
- [ ] Drop-off/locker point lookup
- [ ] Home pickup option where carrier supports it
- [ ] Printerless drop-off (QR/barcode)
- [ ] Custom shipping for oversized items
- [ ] Tracking webhook ingestion → unified tracking view (buyer/seller/support)
- [ ] Ship-window timer with auto-cancel for undispatched orders

### 1.10 Messaging & disputes
- [ ] Real-time chat (WebSockets) between buyer and seller
- [ ] Offers/bundles within conversation
- [ ] Dispute flow: raise issue → freeze payout → manual review → refund or release
- [ ] Ratings & reviews post-transaction

---

## PHASE 2 — Admin Panel & RBAC

### 2.1 Roles (per SOW Section 06)
- [ ] Super admin
- [ ] Manager / operations lead
- [ ] Listing verification officer
- [ ] Identity/KYC reviewer
- [ ] Support agent
- [ ] Dispute / trust & safety officer
- [ ] Marketing manager
- [ ] SEO / content manager
- [ ] Finance / accounts
- [ ] Role-based permission system built to support all roles even if combined initially

### 2.2 Admin screens
- [ ] Admin dashboard (key metrics, activity overview)
- [ ] User management (view, verify, suspend)
- [ ] Listing moderation/approval queue
- [ ] Order & transaction management
- [ ] Dispute resolution console
- [ ] Verification queue (ID + listing)
- [ ] Content/CMS & SEO management
- [ ] Analytics & reports (sales, GMV, category performance, tax reports)
- [ ] Promotions & marketing tools
- [ ] Roles & permissions management

---

## PHASE 2 — Security & Compliance

### 2.3 Security architecture (per SOW Section 10)
- [ ] TLS/HTTPS everywhere, certificate management
- [ ] Encrypted database storage + encrypted backups
- [ ] Secrets in vault, never in code
- [ ] PCI-DSS compliance via payment provider (no raw card storage)
- [ ] Input validation, SQLi/XSS/CSRF protection
- [ ] Rate limiting, bot/abuse protection
- [ ] Fraud prevention: duplicate/stolen-photo detection, velocity checks
- [ ] Firewalls, DDoS protection
- [ ] Isolated dev/staging/prod environments
- [ ] Audit logging across sensitive actions
- [ ] Automated security patching
- [ ] Monitoring: error tracking, uptime, alerting, tested backup/restore

### 2.4 Compliance
- [ ] GDPR/UK-GDPR: consent management, data deletion support
- [ ] Per-country tax reporting integrated into transaction logging
- [ ] KYC/AML documentation trail (handled by provider, not stored raw)

---

## PHASE 3 — Testing, QA & Launch Hardening

### 3.1 Testing
- [ ] Unit tests for wallet/escrow logic (money-critical code)
- [ ] Integration tests for Stripe webhooks (replay, idempotency, failure cases)
- [ ] Integration tests for shipping webhook ingestion
- [ ] End-to-end tests: signup → list → buy → ship → deliver → payout
- [ ] Dispute flow testing (refund and release paths)
- [ ] Load testing before public launch
- [ ] Security review / penetration test (at least a scoped one)

### 3.2 Supporting pages
- [ ] Legal pages: terms, privacy, tax info
- [ ] Help/support + FAQ + ticket system
- [ ] Notification preferences (email/push)
- [ ] Referral program
- [ ] Account settings: profile, addresses, payment methods, security, language/region

### 3.3 Soft launch
- [ ] Limited user group onboarded
- [ ] Monitoring dashboards live (Sentry, uptime)
- [ ] Feedback loop and fast-fix process defined
- [ ] Go/no-go criteria for public launch defined in advance

---

## PHASE 4 — AI Features (post-launch)

- [ ] AI-assisted listing (photo → auto title/category/brand/condition/price)
- [ ] AI-powered natural-language search
- [ ] AI fraud detection at listing time
- [ ] AI-assisted dispute triage
- [ ] Optional: item authentication for designer goods

---

## PHASE 5 — Scale (ongoing)

- [ ] Additional launch markets (currency, payment method, carrier config only — no new engineering)
- [ ] Live auction/bidding
- [ ] Smart bundling suggestions
- [ ] Sustainability layer (CO₂-saved, resale-value counters)
- [ ] Optimized carrier selection logic

---

## Cross-cutting checklist (applies to every phase)
- [ ] No secrets committed to git
- [ ] Every money-related change tested in Stripe test mode before touching production keys
- [ ] Every webhook handler verifies signatures and is idempotent
- [ ] Every new admin capability respects RBAC — no direct DB edits
- [ ] Every schema change goes through a migration, never manual DB edits in production
- [ ] Staging environment mirrors production before any release

---

*Use this as a living checklist — check items off as completed, and don't skip ahead to a later phase's component until the current phase's money-and-trust-critical items (auth, escrow, security) are solid.*
