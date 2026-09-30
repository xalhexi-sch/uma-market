import { NextResponse, type NextRequest } from "next/server";
import { searchActiveProducts, getCategories } from "@/lib/supabase/queries/products";
import { getProductImageUrl } from "@/lib/supabase/storage";

export interface SearchSuggestionItem {
  id: string;
  name: string;
  price_per_unit: number;
  unit: string;
  quantity_available: number;
  min_order_quantity: number;
  image_url: string | null;
  farmer_name: string;
  category_name?: string;
}

export interface SearchSuggestionCategory {
  name: string;
  slug: string;
}

export interface SearchSuggestionsResponse {
  suggestions: SearchSuggestionItem[];
  categories: SearchSuggestionCategory[];
}

/**
 * Lightweight Route Handler returning debounced search suggestions and category matches.
 * Enforces strict input validation, 2-character minimum, and field whitelisting for privacy.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get("q") ?? "";

  // Sanitize: trim whitespace, strip non-printable/control chars, clamp to 50 characters
  const sanitized = rawQ.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, 50);

  // Minimum length guard: return empty response if fewer than 2 characters
  if (sanitized.length < 2) {
    return NextResponse.json<SearchSuggestionsResponse>(
      { suggestions: [], categories: [] },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  }

  try {
    const [searchResult, allCategories] = await Promise.all([
      searchActiveProducts({
        search: sanitized,
        inStockOnly: true,
        limit: 5,
      }),
      getCategories().catch(() => []),
    ]);

    // Strictly whitelist public produce fields to prevent leaking farmer private contact data
    const suggestions: SearchSuggestionItem[] = searchResult.products.map((prod) => ({
      id: prod.id,
      name: prod.name,
      price_per_unit: prod.price_per_unit,
      unit: prod.unit,
      quantity_available: prod.quantity_available,
      min_order_quantity: prod.min_order_quantity,
      image_url: getProductImageUrl(prod.image_path, prod.image_url),
      farmer_name: prod.farmer?.business_name || prod.farmer?.full_name || "Local Farm",
      category_name: prod.category?.name,
    }));

    const lowerQ = sanitized.toLowerCase();
    const matchingCategories: SearchSuggestionCategory[] = allCategories
      .filter((cat) => cat.name.toLowerCase().includes(lowerQ) || cat.slug.toLowerCase().includes(lowerQ))
      .slice(0, 2)
      .map((cat) => ({
        name: cat.name,
        slug: cat.slug,
      }));

    return NextResponse.json<SearchSuggestionsResponse>(
      {
        suggestions,
        categories: matchingCategories,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[api/search/suggestions] Error:", err);
    // Graceful fallback on error: return empty lists rather than 500 error
    return NextResponse.json<SearchSuggestionsResponse>(
      { suggestions: [], categories: [] },
      { status: 200 }
    );
  }
}
