import { NextRequest, NextResponse } from "next/server";
import { searchActiveProducts, type ProductSort } from "@/lib/supabase/queries/products";

export const dynamic = "force-dynamic";

const VALID_SORTS: ProductSort[] = [
  "relevance",
  "newest",
  "harvest_newest",
  "price_asc",
  "price_desc",
  "name_asc",
];

/**
 * GET /api/products/search
 * Authoritative smart-search API endpoint powering live marketplace search-as-you-type.
 * Leverages PostgreSQL search_products RPC with pg_trgm typo tolerance,
 * multi-field ranking, and database-level security/privacy isolation.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim() || undefined;
    const categorySlug = searchParams.get("category")?.trim() || undefined;
    const rawSort = searchParams.get("sort");
    const inStockOnly = searchParams.get("in_stock") !== "false";
    const rawLimit = searchParams.get("limit");
    const rawPage = searchParams.get("page");

    // Clamp pagination bounds
    const limit = rawLimit ? Math.min(Math.max(1, parseInt(rawLimit, 10) || 48), 100) : 48;
    const page = rawPage ? Math.max(1, parseInt(rawPage, 10) || 1) : 1;

    // Determine sort
    let sort: ProductSort = "newest";
    if (rawSort && VALID_SORTS.includes(rawSort as ProductSort)) {
      sort = rawSort as ProductSort;
    } else if (q) {
      sort = "relevance";
    }

    const result = await searchActiveProducts({
      search: q,
      categorySlug,
      sort,
      inStockOnly,
      page,
      limit,
    });

    return NextResponse.json(
      {
        products: result.products,
        totalCount: result.totalCount,
        page: result.page,
        totalPages: result.totalPages,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
        },
      }
    );
  } catch (error: unknown) {
    console.error("Live search API error:", error);
    return NextResponse.json(
      { error: "Failed to execute search query" },
      { status: 500 }
    );
  }
}
