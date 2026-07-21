import { PrismaClient, ListingStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Deterministic IDs so the seed is idempotent (re-running upserts instead of
// duplicating). Categories and listings have no natural unique key, so we pin
// their IDs here.
const USERS = [
  { id: "seed-user-alice", email: "alice@example.com", country: "GB" },
  { id: "seed-user-bob", email: "bob@example.com", country: "GB" },
  { id: "seed-user-carol", email: "carol@example.com", country: "GB" },
];

const CATEGORIES = [
  { id: "seed-cat-women", name: "Women" },
  { id: "seed-cat-men", name: "Men" },
  { id: "seed-cat-kids", name: "Kids" },
  { id: "seed-cat-designer", name: "Designer" },
  { id: "seed-cat-electronics", name: "Electronics" },
];

// Product photos. Interim: catalogue imagery is served locally from
// /public/products (license-free Unsplash stock, downloaded so it renders
// offline and doesn't depend on a hotlink). Before launch, real seller uploads
// flow through /api/upload (Cloudinary) and these seed paths are replaced by
// uploaded assets. Each listing gets a cover + gallery.
const p = (id: string) => `/products/${id}.jpg`;

// 10 listings spread across the 3 sellers and 5 categories.
const LISTINGS = [
  { id: "seed-listing-01", sellerId: "seed-user-alice", categoryId: "seed-cat-women",       title: "Vintage Levi's Denim Jacket", brand: "Levi's",   size: "M",   condition: "Very good", color: "Blue",  price: "45.00", parcelSize: "medium", images: [p("1544022613-e87ca75a784a"), p("1516257984-b1b4d707412e"), p("1543076447-215ad9ba6923")] },
  { id: "seed-listing-02", sellerId: "seed-user-alice", categoryId: "seed-cat-designer",    title: "Gucci Marmont Shoulder Bag",  brand: "Gucci",    size: null,  condition: "Good",      color: "Black", price: "780.00", parcelSize: "small", images: [p("1584917865442-de89df76afd3"), p("1548036328-c9fa89d128fa"), p("1594223274512-ad4803739b7c")] },
  { id: "seed-listing-03", sellerId: "seed-user-alice", categoryId: "seed-cat-women",       title: "Zara Floral Midi Dress",      brand: "Zara",     size: "S",   condition: "New with tags", color: "Multi", price: "22.50", parcelSize: "small", images: [p("1595777457583-95e059d581b8"), p("1572804013309-59a88b7e92f1")] },
  { id: "seed-listing-04", sellerId: "seed-user-bob",   categoryId: "seed-cat-men",         title: "Nike Air Max 90 Sneakers",    brand: "Nike",     size: "UK 9", condition: "Good",      color: "White", price: "60.00", parcelSize: "medium", images: [p("1542291026-7eec264c27ff"), p("1552346154-21d32810aba3"), p("1600269452121-4f2416e55c28")] },
  { id: "seed-listing-05", sellerId: "seed-user-bob",   categoryId: "seed-cat-men",         title: "The North Face Puffer Jacket", brand: "The North Face", size: "L", condition: "Very good", color: "Green", price: "95.00", parcelSize: "large", images: [p("1591047139829-d91aecb6caea"), p("1547949003-9792a18a2601")] },
  { id: "seed-listing-06", sellerId: "seed-user-bob",   categoryId: "seed-cat-electronics", title: "Sony WH-1000XM4 Headphones",  brand: "Sony",     size: null,  condition: "Like new",  color: "Black", price: "140.00", parcelSize: "medium", images: [p("1505740420928-5e560c06d30e"), p("1583394838336-acd977736f90"), p("1484704849700-f032a568e944")] },
  { id: "seed-listing-07", sellerId: "seed-user-carol", categoryId: "seed-cat-kids",        title: "Kids' Wooden Train Set",      brand: "BRIO",     size: null,  condition: "Good",      color: "Multi", price: "18.00", parcelSize: "medium", images: [p("1558060370-d644479cb6f7"), p("1515488042361-ee00e0ddd4e4")] },
  { id: "seed-listing-08", sellerId: "seed-user-carol", categoryId: "seed-cat-kids",        title: "Baby Winter Snowsuit 6-9m",   brand: "Next",     size: "6-9m", condition: "Very good", color: "Pink",  price: "12.00", parcelSize: "small", images: [p("1522771930-78848d9293e8"), p("1503919545889-aef636e10ad4")] },
  { id: "seed-listing-09", sellerId: "seed-user-carol", categoryId: "seed-cat-designer",    title: "Burberry Cashmere Scarf",     brand: "Burberry", size: null,  condition: "New without tags", color: "Beige", price: "210.00", parcelSize: "small", images: [p("1601924994987-69e26d50dc26"), p("1606760227091-3dd870d97f1d")] },
  { id: "seed-listing-10", sellerId: "seed-user-carol", categoryId: "seed-cat-electronics", title: "Apple iPhone 12 128GB",       brand: "Apple",    size: null,  condition: "Good",      color: "Blue",  price: "320.00", parcelSize: "small", images: [p("1592750475338-74b7b21085ab"), p("1605236453806-6ff36851218e"), p("1510557880182-3d4d3cba35a5")] },
];

async function main() {
  // Shared test password for all seeded users (local/dev only).
  const passwordHash = await bcrypt.hash("Password123!", 10);

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id,
        email: u.email,
        passwordHash,
        emailVerified: true,
        country: u.country,
        currency: "GBP",
        language: "en",
      },
    });
  }
  console.log(`Seeded ${USERS.length} users.`);

  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: { name: c.name },
      create: { id: c.id, name: c.name },
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories.`);

  for (const l of LISTINGS) {
    await prisma.listing.upsert({
      where: { id: l.id },
      // Re-running the seed backfills imagery onto existing rows.
      update: { images: l.images },
      create: {
        id: l.id,
        sellerId: l.sellerId,
        categoryId: l.categoryId,
        title: l.title,
        description: `${l.title} — seeded test listing. Great condition, ships from the UK.`,
        brand: l.brand,
        size: l.size,
        condition: l.condition,
        color: l.color,
        price: l.price,
        currency: "GBP",
        parcelSize: l.parcelSize,
        images: l.images,
        status: ListingStatus.ACTIVE,
        country: "GB",
      },
    });
  }
  console.log(`Seeded ${LISTINGS.length} listings.`);
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
