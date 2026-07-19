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

// 10 listings spread across the 3 sellers and 5 categories.
const LISTINGS = [
  { id: "seed-listing-01", sellerId: "seed-user-alice", categoryId: "seed-cat-women",       title: "Vintage Levi's Denim Jacket", brand: "Levi's",   size: "M",   condition: "Very good", color: "Blue",  price: "45.00", parcelSize: "medium" },
  { id: "seed-listing-02", sellerId: "seed-user-alice", categoryId: "seed-cat-designer",    title: "Gucci Marmont Shoulder Bag",  brand: "Gucci",    size: null,  condition: "Good",      color: "Black", price: "780.00", parcelSize: "small" },
  { id: "seed-listing-03", sellerId: "seed-user-alice", categoryId: "seed-cat-women",       title: "Zara Floral Midi Dress",      brand: "Zara",     size: "S",   condition: "New with tags", color: "Multi", price: "22.50", parcelSize: "small" },
  { id: "seed-listing-04", sellerId: "seed-user-bob",   categoryId: "seed-cat-men",         title: "Nike Air Max 90 Sneakers",    brand: "Nike",     size: "UK 9", condition: "Good",      color: "White", price: "60.00", parcelSize: "medium" },
  { id: "seed-listing-05", sellerId: "seed-user-bob",   categoryId: "seed-cat-men",         title: "The North Face Puffer Jacket", brand: "The North Face", size: "L", condition: "Very good", color: "Green", price: "95.00", parcelSize: "large" },
  { id: "seed-listing-06", sellerId: "seed-user-bob",   categoryId: "seed-cat-electronics", title: "Sony WH-1000XM4 Headphones",  brand: "Sony",     size: null,  condition: "Like new",  color: "Black", price: "140.00", parcelSize: "medium" },
  { id: "seed-listing-07", sellerId: "seed-user-carol", categoryId: "seed-cat-kids",        title: "Kids' Wooden Train Set",      brand: "BRIO",     size: null,  condition: "Good",      color: "Multi", price: "18.00", parcelSize: "medium" },
  { id: "seed-listing-08", sellerId: "seed-user-carol", categoryId: "seed-cat-kids",        title: "Baby Winter Snowsuit 6-9m",   brand: "Next",     size: "6-9m", condition: "Very good", color: "Pink",  price: "12.00", parcelSize: "small" },
  { id: "seed-listing-09", sellerId: "seed-user-carol", categoryId: "seed-cat-designer",    title: "Burberry Cashmere Scarf",     brand: "Burberry", size: null,  condition: "New without tags", color: "Beige", price: "210.00", parcelSize: "small" },
  { id: "seed-listing-10", sellerId: "seed-user-carol", categoryId: "seed-cat-electronics", title: "Apple iPhone 12 128GB",       brand: "Apple",    size: null,  condition: "Good",      color: "Blue",  price: "320.00", parcelSize: "small" },
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
      update: {},
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
        images: [],
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
