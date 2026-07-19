import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

// GET /api/categories
// Public read of the category tree, used to populate the listing form's
// category selector. Not in the original route map — added here because the
// listing form (1.4) needs categories and there is no search route yet.
export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, parentId: true },
  });

  return NextResponse.json({ categories });
}
