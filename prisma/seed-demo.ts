import {
  PrismaClient,
  ListingStatus,
  OrderStatus,
  WalletState,
  DisputeStatus,
  AdminRole,
  VerificationLevel,
  NotificationChannel,
  TicketStatus,
  OfferStatus,
  WithdrawalStatus,
  CampaignType,
  ContentStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

// ============================================================================
// DEMO / SHOWCASE SEED  (npm run db:seed:demo)
//
// Populates the database with named demo accounts + believable cross-model data
// so every customer surface and every admin console section has something real
// to show in a walkthrough. Idempotent: all rows use pinned ids and upsert, so
// re-running updates in place rather than duplicating.
//
// Demo credentials (also written to README.md):
//   Customers (password: Demo1234!)
//     demo.buyer@reloved.app     — buyer-heavy dual-role account
//     demo.seller@reloved.app    — seller-heavy dual-role account (KYC L3)
//   Admins (password: Admin1234!) — one per RBAC section
//     admin.super@reloved.app     SUPER_ADMIN   (all sections)
//     admin.manager@reloved.app   MANAGER
//     admin.listings@reloved.app  LISTING_VERIFICATION_OFFICER
//     admin.kyc@reloved.app       KYC_REVIEWER
//     admin.support@reloved.app   SUPPORT_AGENT
//     admin.safety@reloved.app    TRUST_AND_SAFETY
//     admin.marketing@reloved.app MARKETING
//     admin.seo@reloved.app       SEO_CONTENT
//     admin.finance@reloved.app   FINANCE
//
// NOTE: demo data only — safe for staging. Not for a live production launch.
// ============================================================================

const prisma = new PrismaClient();

const CUSTOMER_PW = "Demo1234!";
const ADMIN_PW = "Admin1234!";

const img = (id: string) => `/products/${id}.jpg`;

// Reuse the base-seed categories so demo listings land in real categories.
const CATEGORIES = [
  { id: "seed-cat-women", name: "Women" },
  { id: "seed-cat-men", name: "Men" },
  { id: "seed-cat-kids", name: "Kids" },
  { id: "seed-cat-designer", name: "Designer" },
  { id: "seed-cat-electronics", name: "Electronics" },
];

const CUSTOMERS = [
  {
    id: "demo-buyer",
    email: "demo.buyer@reloved.app",
    verificationLevel: VerificationLevel.LEVEL_1_BASIC,
    country: "GB",
    referralCode: "EMMA-2026",
  },
  {
    id: "demo-seller",
    email: "demo.seller@reloved.app",
    verificationLevel: VerificationLevel.LEVEL_3_ID_VERIFIED,
    country: "GB",
    referralCode: "JAMES-2026",
    stripeAccountId: "acct_demo_seller",
  },
];

const ADMINS: { id: string; email: string; role: AdminRole }[] = [
  { id: "demo-admin-super", email: "admin.super@reloved.app", role: AdminRole.SUPER_ADMIN },
  { id: "demo-admin-manager", email: "admin.manager@reloved.app", role: AdminRole.MANAGER },
  { id: "demo-admin-listings", email: "admin.listings@reloved.app", role: AdminRole.LISTING_VERIFICATION_OFFICER },
  { id: "demo-admin-kyc", email: "admin.kyc@reloved.app", role: AdminRole.KYC_REVIEWER },
  { id: "demo-admin-support", email: "admin.support@reloved.app", role: AdminRole.SUPPORT_AGENT },
  { id: "demo-admin-safety", email: "admin.safety@reloved.app", role: AdminRole.TRUST_AND_SAFETY },
  { id: "demo-admin-marketing", email: "admin.marketing@reloved.app", role: AdminRole.MARKETING },
  { id: "demo-admin-seo", email: "admin.seo@reloved.app", role: AdminRole.SEO_CONTENT },
  { id: "demo-admin-finance", email: "admin.finance@reloved.app", role: AdminRole.FINANCE },
];

// Demo seller's catalogue, in several states so the Listings section has active,
// sold, pending-review and hidden rows to moderate.
const LISTINGS = [
  { id: "demo-listing-active-1", categoryId: "seed-cat-men", title: "Barbour Wax Jacket", brand: "Barbour", size: "L", condition: "Very good", color: "Green", price: "89.00", status: ListingStatus.ACTIVE, images: [img("1591047139829-d91aecb6caea"), img("1547949003-9792a18a2601")] },
  { id: "demo-listing-active-2", categoryId: "seed-cat-designer", title: "Ralph Lauren Wool Coat", brand: "Ralph Lauren", size: "M", condition: "Like new", color: "Camel", price: "120.00", status: ListingStatus.ACTIVE, images: [img("1601924994987-69e26d50dc26"), img("1606760227091-3dd870d97f1d")] },
  { id: "demo-listing-active-3", categoryId: "seed-cat-electronics", title: "iPad Air 2022 64GB", brand: "Apple", size: null, condition: "Good", color: "Grey", price: "290.00", status: ListingStatus.ACTIVE, images: [img("1592750475338-74b7b21085ab"), img("1605236453806-6ff36851218e")] },
  { id: "demo-listing-sold-1", categoryId: "seed-cat-men", title: "Adidas Samba OG UK 8", brand: "Adidas", size: "UK 8", condition: "Good", color: "Black", price: "55.00", status: ListingStatus.SOLD, images: [img("1542291026-7eec264c27ff"), img("1552346154-21d32810aba3")] },
  { id: "demo-listing-pending-1", categoryId: "seed-cat-designer", title: "Prada Re-Edition Nylon Bag", brand: "Prada", size: null, condition: "New with tags", color: "Black", price: "690.00", status: ListingStatus.PENDING_REVIEW, images: [img("1584917865442-de89df76afd3"), img("1548036328-c9fa89d128fa")] },
  { id: "demo-listing-pending-2", categoryId: "seed-cat-women", title: "Reformation Silk Slip Dress", brand: "Reformation", size: "S", condition: "New without tags", color: "Wine", price: "78.00", status: ListingStatus.PENDING_REVIEW, images: [img("1595777457583-95e059d581b8"), img("1572804013309-59a88b7e92f1")] },
  { id: "demo-listing-hidden-1", categoryId: "seed-cat-electronics", title: "Replica AirPods (flagged)", brand: "Unbranded", size: null, condition: "Good", color: "White", price: "15.00", status: ListingStatus.HIDDEN, images: [img("1505740420928-5e560c06d30e")] },
];

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  const customerHash = await bcrypt.hash(CUSTOMER_PW, 10);
  const adminHash = await bcrypt.hash(ADMIN_PW, 10);

  // --- Categories (reuse base seed ids) -----------------------------------
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: { name: c.name },
      create: { id: c.id, name: c.name },
    });
  }

  // --- Customers -----------------------------------------------------------
  for (const u of CUSTOMERS) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        verificationLevel: u.verificationLevel,
        referralCode: u.referralCode,
        stripeAccountId: u.stripeAccountId ?? null,
      },
      create: {
        id: u.id,
        email: u.email,
        passwordHash: customerHash,
        emailVerified: true,
        phoneVerified: true,
        verificationLevel: u.verificationLevel,
        country: u.country,
        currency: "GBP",
        language: "en",
        referralCode: u.referralCode,
        stripeAccountId: u.stripeAccountId ?? null,
      },
    });
  }

  // --- Admins + role assignments ------------------------------------------
  for (const a of ADMINS) {
    await prisma.user.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        email: a.email,
        passwordHash: adminHash,
        emailVerified: true,
        verificationLevel: VerificationLevel.LEVEL_3_ID_VERIFIED,
        country: "GB",
        currency: "GBP",
        language: "en",
      },
    });
    await prisma.adminRoleAssignment.upsert({
      where: { userId_role: { userId: a.id, role: a.role } },
      update: {},
      create: { userId: a.id, role: a.role },
    });
  }

  // --- Demo seller catalogue ----------------------------------------------
  for (const l of LISTINGS) {
    await prisma.listing.upsert({
      where: { id: l.id },
      update: { status: l.status, images: l.images, price: l.price },
      create: {
        id: l.id,
        sellerId: "demo-seller",
        categoryId: l.categoryId,
        title: l.title,
        description: `${l.title} — ships from the UK with buyer protection. Smoke-free home, fast dispatch.`,
        brand: l.brand,
        size: l.size,
        condition: l.condition,
        color: l.color,
        price: l.price,
        currency: "GBP",
        parcelSize: "medium",
        images: l.images,
        status: l.status,
        country: "GB",
      },
    });
  }

  // --- Buyer profile extras: address, card, notification prefs ------------
  await prisma.address.upsert({
    where: { id: "demo-addr-buyer" },
    update: {},
    create: {
      id: "demo-addr-buyer",
      userId: "demo-buyer",
      line1: "42 Camden High Street",
      city: "London",
      postalCode: "NW1 0JH",
      country: "GB",
      isDefault: true,
    },
  });
  await prisma.paymentMethod.upsert({
    where: { id: "demo-pm-buyer" },
    update: {},
    create: {
      id: "demo-pm-buyer",
      userId: "demo-buyer",
      providerMethodId: "pm_demo_visa",
      brand: "visa",
      last4: "4242",
      expMonth: 11,
      expYear: 2030,
      isDefault: true,
    },
  });
  await prisma.notificationPreference.upsert({
    where: { userId: "demo-buyer" },
    update: {},
    create: { userId: "demo-buyer", emailMarketing: true },
  });

  // --- Seller payout: verified bank account -------------------------------
  await prisma.bankAccount.upsert({
    where: { id: "demo-bank-seller" },
    update: {},
    create: {
      id: "demo-bank-seller",
      userId: "demo-seller",
      label: "Barclays current",
      holderName: "James Whitfield",
      country: "GB",
      currency: "GBP",
      last4: "8812",
      providerAccountId: "ba_demo_seller",
      verified: true,
      isDefault: true,
    },
  });

  // --- Orders across the escrow lifecycle ---------------------------------
  // Helper to compute price fields consistently.
  const money = (item: number, ship = 3.99) => {
    const protection = +(item * 0.05 + 0.7).toFixed(2);
    return {
      itemPrice: item.toFixed(2),
      shippingPrice: ship.toFixed(2),
      protectionFee: protection.toFixed(2),
      totalPrice: (item + ship + protection).toFixed(2),
      currency: "GBP",
    };
  };

  const ORDERS = [
    // Buyer bought from an existing seed seller — DELIVERED, awaiting confirm.
    { id: "demo-order-1", buyerId: "demo-buyer", sellerId: "seed-user-alice", listingId: "seed-listing-01", status: OrderStatus.DELIVERED, item: 45, created: 6, shippedAgo: 4, deliveredAgo: 1 },
    // Buyer bought and released — completed, seller earned.
    { id: "demo-order-2", buyerId: "demo-buyer", sellerId: "seed-user-bob", listingId: "seed-listing-06", status: OrderStatus.RELEASED, item: 140, created: 20, shippedAgo: 18, deliveredAgo: 15, releasedAgo: 12 },
    // Buyer paid, not yet shipped.
    { id: "demo-order-3", buyerId: "demo-buyer", sellerId: "seed-user-carol", listingId: "seed-listing-10", status: OrderStatus.PAID, item: 320, created: 1 },
    // Buyer opened a DISPUTE (feeds Disputes + Trust & Safety sections).
    { id: "demo-order-4", buyerId: "demo-buyer", sellerId: "seed-user-bob", listingId: "seed-listing-05", status: OrderStatus.DISPUTED, item: 95, created: 10, shippedAgo: 8, deliveredAgo: 5 },
    // Demo SELLER made a sale that RELEASED — funds available to withdraw.
    { id: "demo-order-5", buyerId: "seed-user-alice", sellerId: "demo-seller", listingId: "demo-listing-sold-1", status: OrderStatus.RELEASED, item: 55, created: 25, shippedAgo: 23, deliveredAgo: 20, releasedAgo: 17 },
    // Demo SELLER has an in-flight sale, SHIPPED.
    { id: "demo-order-6", buyerId: "seed-user-carol", sellerId: "demo-seller", listingId: "demo-listing-active-1", status: OrderStatus.SHIPPED, item: 89, created: 3, shippedAgo: 1 },
  ];

  for (const o of ORDERS) {
    const m = money(o.item);
    await prisma.order.upsert({
      where: { id: o.id },
      update: { status: o.status },
      create: {
        id: o.id,
        buyerId: o.buyerId,
        sellerId: o.sellerId,
        listingId: o.listingId,
        status: o.status,
        ...m,
        stripePaymentIntentId: `pi_demo_${o.id}`,
        shippingCarrier: o.shippedAgo ? "Royal Mail" : null,
        trackingNumber: o.shippedAgo ? `RM${o.id.toUpperCase()}GB` : null,
        shippedAt: o.shippedAgo ? daysAgo(o.shippedAgo) : null,
        deliveredAt: o.deliveredAgo ? daysAgo(o.deliveredAgo) : null,
        releasedAt: o.releasedAgo ? daysAgo(o.releasedAgo) : null,
        createdAt: daysAgo(o.created),
      },
    });
  }

  // --- Wallet transactions (seller earnings) ------------------------------
  // Released sale → AVAILABLE; shipped sale → PENDING (escrow held).
  await prisma.walletTransaction.upsert({
    where: { id: "demo-wtx-1" },
    update: { state: WalletState.AVAILABLE },
    create: {
      id: "demo-wtx-1",
      userId: "demo-seller",
      orderId: "demo-order-5",
      amount: "52.25", // net of fees
      currency: "GBP",
      state: WalletState.AVAILABLE,
    },
  });
  await prisma.walletTransaction.upsert({
    where: { id: "demo-wtx-2" },
    update: { state: WalletState.PENDING },
    create: {
      id: "demo-wtx-2",
      userId: "demo-seller",
      orderId: "demo-order-6",
      amount: "84.55",
      currency: "GBP",
      state: WalletState.PENDING,
    },
  });

  // --- Dispute on demo-order-4 (Disputes / Trust & Safety) ----------------
  await prisma.dispute.upsert({
    where: { orderId: "demo-order-4" },
    update: { status: DisputeStatus.UNDER_REVIEW },
    create: {
      orderId: "demo-order-4",
      raisedById: "demo-buyer",
      reason: "Item not as described — the puffer jacket has a broken zip that wasn't mentioned in the listing.",
      status: DisputeStatus.UNDER_REVIEW,
      createdAt: daysAgo(4),
    },
  });

  // --- Withdrawal request (Finance section) -------------------------------
  await prisma.withdrawal.upsert({
    where: { id: "demo-withdrawal-1" },
    update: { status: WithdrawalStatus.REQUESTED },
    create: {
      id: "demo-withdrawal-1",
      userId: "demo-seller",
      bankAccountId: "demo-bank-seller",
      amount: "50.00",
      currency: "GBP",
      status: WithdrawalStatus.REQUESTED,
      createdAt: daysAgo(2),
    },
  });

  // --- KYC verification record (KYC Reviewer section) ---------------------
  // A pending record so the verification queue isn't empty.
  const existingVr = await prisma.verificationRecord.findFirst({
    where: { userId: "demo-buyer", provider: "persona" },
  });
  if (!existingVr) {
    await prisma.verificationRecord.create({
      data: {
        userId: "demo-buyer",
        provider: "persona",
        providerRefId: "inq_demo_buyer",
        status: "pending",
      },
    });
  }

  // --- Support ticket (Support Agent section) -----------------------------
  await prisma.supportTicket.upsert({
    where: { id: "demo-ticket-1" },
    update: { status: TicketStatus.OPEN },
    create: {
      id: "demo-ticket-1",
      requesterId: "demo-buyer",
      subject: "Where is my order? Tracking hasn't updated in 3 days",
      category: "shipping",
      status: TicketStatus.OPEN,
      createdAt: daysAgo(2),
      lastReplyAt: daysAgo(2),
    },
  });
  const ticketMsgCount = await prisma.ticketMessage.count({
    where: { ticketId: "demo-ticket-1" },
  });
  if (ticketMsgCount === 0) {
    await prisma.ticketMessage.create({
      data: {
        ticketId: "demo-ticket-1",
        authorId: "demo-buyer",
        fromStaff: false,
        body: "Hi, I ordered the Sony headphones a few days ago and the tracking number hasn't moved. Can you check what's going on?",
        createdAt: daysAgo(2),
      },
    });
  }

  // --- Ratings (seller reputation) ----------------------------------------
  await prisma.rating.upsert({
    where: { id: "demo-rating-1" },
    update: {},
    create: {
      id: "demo-rating-1",
      orderId: "demo-order-5",
      authorId: "seed-user-alice",
      targetId: "demo-seller",
      score: 5,
      comment: "Item exactly as described, super fast postage. Would buy again!",
      createdAt: daysAgo(16),
    },
  });

  // --- Social: buyer follows sellers + favourites -------------------------
  for (const [i, followingId] of ["demo-seller", "seed-user-bob"].entries()) {
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: "demo-buyer", followingId } },
      update: {},
      create: { id: `demo-follow-${i}`, followerId: "demo-buyer", followingId },
    });
  }
  await prisma.favorite.upsert({
    where: { userId_listingId: { userId: "demo-buyer", listingId: "demo-listing-active-2" } },
    update: {},
    create: { userId: "demo-buyer", listingId: "demo-listing-active-2" },
  });

  // --- An offer on a demo listing (negotiation) ---------------------------
  await prisma.offer.upsert({
    where: { id: "demo-offer-1" },
    update: { status: OfferStatus.PENDING },
    create: {
      id: "demo-offer-1",
      listingId: "demo-listing-active-2",
      buyerId: "demo-buyer",
      amount: "100.00",
      currency: "GBP",
      status: OfferStatus.PENDING,
      message: "Would you take £100 posted?",
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      createdAt: daysAgo(1),
    },
  });

  // --- Notifications for the buyer ----------------------------------------
  const notifCount = await prisma.notification.count({ where: { userId: "demo-buyer" } });
  if (notifCount === 0) {
    await prisma.notification.createMany({
      data: [
        { userId: "demo-buyer", channel: NotificationChannel.EMAIL, title: "Your order shipped", body: "Vintage Levi's Denim Jacket is on its way.", read: true, createdAt: daysAgo(4) },
        { userId: "demo-buyer", channel: NotificationChannel.PUSH, title: "Price drop", body: "A seller you follow lowered a price.", read: false, createdAt: daysAgo(1) },
      ],
    });
  }

  // --- Referral (buyer was referred by seller) ----------------------------
  await prisma.referral.upsert({
    where: { referredId: "demo-buyer" },
    update: {},
    create: {
      id: "demo-referral-1",
      referrerId: "demo-seller",
      referredId: "demo-buyer",
      code: "JAMES-2026",
      status: "QUALIFIED",
      qualifiedAt: daysAgo(6),
      createdAt: daysAgo(30),
    },
  });

  // --- Marketing campaign (Marketing section) -----------------------------
  await prisma.campaign.upsert({
    where: { id: "demo-campaign-1" },
    update: { active: true },
    create: {
      id: "demo-campaign-1",
      name: "Summer Pre-Loved Sale",
      type: CampaignType.BANNER,
      active: true,
      startsAt: daysAgo(3),
      endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      payload: { headline: "Up to 70% off summer styles", target: "/search?sort=newest" },
      createdById: "demo-admin-marketing",
    },
  });

  // --- CMS content page (SEO / Content section) ---------------------------
  await prisma.contentPage.upsert({
    where: { slug: "how-buyer-protection-works" },
    update: {},
    create: {
      slug: "how-buyer-protection-works",
      title: "How Buyer Protection Works",
      body: "# Buyer Protection\n\nEvery purchase on Reloved is covered...",
      isBlog: false,
      status: ContentStatus.PUBLISHED,
      metaTitle: "Buyer Protection — Reloved",
      metaDescription: "Learn how escrow and buyer protection keep your purchases safe on Reloved.",
      authorId: "demo-admin-seo",
      publishedAt: daysAgo(5),
    },
  });

  console.log("Demo seed complete:");
  console.log(`  ${CUSTOMERS.length} customers, ${ADMINS.length} admins (one per section)`);
  console.log(`  ${LISTINGS.length} demo listings, ${ORDERS.length} orders across the escrow lifecycle`);
  console.log("  + dispute, withdrawal, KYC record, support ticket, campaign, CMS page, offer, follows, ratings");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
