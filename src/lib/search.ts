import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

// ==============================================================
// Listing search (Phase 1.6)
// ==============================================================
// INTERIM IMPLEMENTATION — flagged per CLAUDE.md.
// The approved stack lists Algolia/Typesense for search; Postgres full-text
// search is explicitly allowed as an interim step and MUST be flagged.
//
// This uses Prisma's `contains` (ILIKE, case-insensitive) across title/brand/
// description rather than a tsvector index. It is correct and good enough for
// launch-scale catalogs, but must be swapped for a real search service
// (Algolia/Typesense) before scale. Do not treat this as the permanent search.

export type ListingSort = "recent" | "price_asc" | "price_desc";

export type SearchFilters = {
  q?: string;
  categoryId?: string;
  brand?: string;
  size?: string;
  condition?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  country?: string;
  sort?: ListingSort;
  page?: number;
  perPage?: number;
};

const DEFAULT_PER_PAGE = 24;
const MAX_PER_PAGE = 60;

function orderByFor(sort: ListingSort | undefined): Prisma.ListingOrderByWithRelationInput {
  switch (sort) {
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    case "recent":
    default:
      return { createdAt: "desc" };
  }
}

// Only ACTIVE listings are ever searchable/browsable by the public. Drafts,
// hidden, sold, reserved, and moderation states are excluded here.
export function buildWhere(filters: SearchFilters): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = { status: "ACTIVE" };

  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
  }

  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.brand) where.brand = { contains: filters.brand, mode: "insensitive" };
  if (filters.size) where.size = { equals: filters.size, mode: "insensitive" };
  if (filters.condition) where.condition = { equals: filters.condition, mode: "insensitive" };
  if (filters.color) where.color = { equals: filters.color, mode: "insensitive" };
  if (filters.country) where.country = filters.country.toUpperCase();

  if (filters.minPrice != null || filters.maxPrice != null) {
    where.price = {};
    if (filters.minPrice != null) where.price.gte = filters.minPrice;
    if (filters.maxPrice != null) where.price.lte = filters.maxPrice;
  }

  return where;
}

export async function searchListings(filters: SearchFilters) {
  const perPage = Math.min(filters.perPage ?? DEFAULT_PER_PAGE, MAX_PER_PAGE);
  const page = Math.max(filters.page ?? 1, 1);
  const where = buildWhere(filters);

  const [total, rows] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: orderByFor(filters.sort),
      skip: (page - 1) * perPage,
      take: perPage,
      include: { category: { select: { name: true } } },
    }),
  ]);

  return {
    page,
    perPage,
    total,
    totalPages: Math.max(Math.ceil(total / perPage), 1),
    listings: rows.map((l) => ({ ...l, price: l.price.toString() })),
  };
}
