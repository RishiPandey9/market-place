import { NextResponse, type NextRequest } from "next/server";

import { searchListings } from "@/lib/search";
import { searchQuerySchema } from "@/lib/validation";

// GET /api/search
// Public listing search + filters (Phase 1.6). Reads filters from the query
// string. INTERIM Postgres search — see /src/lib/search.ts header for the flag.
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = searchQuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await searchListings(parsed.data);
  return NextResponse.json(result);
}
