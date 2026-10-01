import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Product, Category, ProductImageItem } from "@/lib/types";

export type ProductSort = "relevance" | "price_asc" | "price_desc" | "harvest_newest" | "newest" | "name_asc";

export interface ProductFilters {
  search?: string;
  categorySlug?: string;
  sort?: ProductSort;
  inStockOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface SearchActiveProductsResult {
  products: Product[];
  totalCount: number;
  page: number;
  totalPages: number;
}

function parseRpcImages(raw: unknown): ProductImageItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((img): img is Record<string, unknown> => typeof img === "object" && img !== null)
    .map((img) => ({
      id: String(img.id ?? ""),
      product_id: String(img.product_id ?? ""),
      image_path: String(img.image_path ?? ""),
      sort_order: Number(img.sort_order ?? 0),
    }));
}

function parseRpcCategory(raw: unknown): Product["category"] {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (typeof c.id === "string" && typeof c.name === "string" && typeof c.slug === "string") {
    return { id: c.id, name: c.name, slug: c.slug };
  }
  return undefined;
}

function parseRpcFarmer(raw: unknown): Product["farmer"] {
  if (!raw || typeof raw !== "object") return undefined;
  const f = raw as Record<string, unknown>;
  if (typeof f.clerk_id === "string") {
    return {
      clerk_id: f.clerk_id,
      full_name: typeof f.full_name === "string" ? f.full_name : null,
      business_name: typeof f.business_name === "string" ? f.business_name : null,
      city: typeof f.city === "string" ? f.city : "",
      avatar_url: typeof f.avatar_url === "string" ? f.avatar_url : null,
      bio: typeof f.bio === "string" ? f.bio : null,
      is_verified: Boolean(f.is_verified),
    };
  }
  return undefined;
}

/**
 * Execute smart search and filtered discovery via the authoritative search_products PostgreSQL RPC.
 * Supports pg_trgm typo tolerance, multi-field weighted ranking, and database-level filtering.
 */
export async function searchActiveProducts({
  search,
  categorySlug,
  sort = "relevance",
  inStockOnly = true,
  page = 1,
  limit = 24,
}: ProductFilters = {}): Promise<SearchActiveProductsResult> {
  const supabase = await createClient();
  const offset = Math.max(0, (page - 1) * limit);

  // If there's no search query and sort is 'relevance', default to 'newest'
  const effectiveSort: ProductSort =
    !search?.trim() && sort === "relevance" ? "newest" : sort;

  const rpcParams = {
    p_search: search?.trim() || undefined,
    p_category_slug: categorySlug?.trim() || undefined,
    p_in_stock_only: inStockOnly,
    p_sort: effectiveSort,
    p_limit: limit,
    p_offset: offset,
  };

  const { data, error } = await supabase.rpc("search_products", rpcParams);

  if (error) throw error;

  const rows = data ?? [];
  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1;

  const products: Product[] = rows.map((row) => {
    let images = parseRpcImages(row.images);
    if (images.length > 0) {
      images = [...images].sort((a, b) => a.sort_order - b.sort_order);
    } else if (row.image_path || row.image_url) {
      images = [
        {
          id: "primary",
          product_id: row.id,
          image_path: row.image_path || row.image_url || "",
          sort_order: 0,
        },
      ];
    }

    return {
      id: row.id,
      farmer_clerk_id: row.farmer_clerk_id,
      category_id: row.category_id,
      name: row.name,
      description: row.description,
      price_per_unit: Number(row.price_per_unit),
      unit: row.unit,
      quantity_available: Number(row.quantity_available),
      min_order_quantity: Number(row.min_order_quantity),
      image_url: row.image_url,
      image_path: row.image_path,
      harvest_date: row.harvest_date,
      available_until: row.available_until,
      status: row.status as Product["status"],
      created_at: row.created_at,
      updated_at: row.updated_at,
      category: parseRpcCategory(row.category),
      farmer: parseRpcFarmer(row.farmer),
      images,
    };
  });

  return {
    products,
    totalCount,
    page,
    totalPages,
  };
}

/**
 * Fetch active products for marketplace and business browsing.
 * Backwards-compatible wrapper around searchActiveProducts.
 */
export async function getActiveProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const result = await searchActiveProducts(filters);
  return result.products;
}

/**
 * Fetch count of active products owned by a farmer (drives dashboard metric).
 * Uses lightweight head: true count to avoid overfetching full product records.
 */
export async function getFarmerActiveProductCount(farmerClerkId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("farmer_clerk_id", farmerClerkId)
    .eq("status", "active");

  if (error) {
    console.error("[products] getFarmerActiveProductCount error:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Fetch a single active product by ID, with farmer + category.
 * Uses public_farmer_profiles view for the farmer projection to support
 * public/anonymous access without forbidden joins or service-role fallbacks.
 * Wrapped in React cache() to deduplicate render passes (e.g. generateMetadata + Page).
 */
export const getProductById = cache(
  async (id: string): Promise<Product | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id, farmer_clerk_id, category_id, name, description,
        price_per_unit, unit, quantity_available, min_order_quantity,
        image_url, image_path, harvest_date, available_until, status, created_at, updated_at,
        farmer:public_farmer_profiles(clerk_id, full_name, business_name, city, avatar_url, bio, is_verified),
        category:categories(id, name, slug),
        images:product_images(id, product_id, image_path, sort_order)
      `
      )
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    let images: Product["images"] = [];
    if (data.images && data.images.length > 0) {
      images = [...data.images].sort((a, b) => a.sort_order - b.sort_order);
    } else if (data.image_path || data.image_url) {
      images = [
        {
          id: "primary",
          product_id: data.id,
          image_path: data.image_path || data.image_url || "",
          sort_order: 0,
        },
      ];
    }

    return {
      id: data.id,
      farmer_clerk_id: data.farmer_clerk_id,
      category_id: data.category_id,
      name: data.name,
      description: data.description,
      price_per_unit: Number(data.price_per_unit),
      unit: data.unit,
      quantity_available: Number(data.quantity_available),
      min_order_quantity: Number(data.min_order_quantity),
      image_url: data.image_url,
      image_path: data.image_path,
      harvest_date: data.harvest_date,
      available_until: data.available_until,
      status: data.status as Product["status"],
      created_at: data.created_at,
      updated_at: data.updated_at,
      farmer: data.farmer && data.farmer.clerk_id
        ? {
            clerk_id: data.farmer.clerk_id,
            full_name: data.farmer.full_name,
            business_name: data.farmer.business_name,
            city: data.farmer.city ?? "",
            avatar_url: data.farmer.avatar_url,
            bio: data.farmer.bio,
            is_verified: Boolean(data.farmer.is_verified),
          }
        : undefined,
      category: data.category ?? undefined,
      images,
    };
  }
);

/**
 * Fetch all products owned by a farmer. Returns all statuses.
 */
export async function getFarmerProducts(farmerClerkId: string): Promise<Product[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, farmer_clerk_id, category_id, name, description,
      price_per_unit, unit, quantity_available, min_order_quantity,
      image_url, image_path, harvest_date, available_until, status, created_at, updated_at,
      category:categories(id, name, slug)
    `
    )
    .eq("farmer_clerk_id", farmerClerkId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    farmer_clerk_id: p.farmer_clerk_id,
    category_id: p.category_id,
    name: p.name,
    description: p.description,
    price_per_unit: Number(p.price_per_unit),
    unit: p.unit,
    quantity_available: Number(p.quantity_available),
    min_order_quantity: Number(p.min_order_quantity),
    image_url: p.image_url,
    image_path: p.image_path,
    harvest_date: p.harvest_date,
    available_until: p.available_until,
    status: p.status as Product["status"],
    created_at: p.created_at,
    updated_at: p.updated_at,
    category: p.category ?? undefined,
    images: [],
  }));
}

/**
 * Fetch a single product owned by the given farmer.
 */
export async function getFarmerProductById(
  id: string,
  farmerClerkId: string
): Promise<Product | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, farmer_clerk_id, category_id, name, description,
      price_per_unit, unit, quantity_available, min_order_quantity,
      image_url, image_path, harvest_date, available_until, status, created_at, updated_at,
      category:categories(id, name, slug),
      images:product_images(id, product_id, image_path, sort_order)
    `
    )
    .eq("id", id)
    .eq("farmer_clerk_id", farmerClerkId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  let images: Product["images"] = [];
  if (data.images && data.images.length > 0) {
    images = [...data.images].sort((a, b) => a.sort_order - b.sort_order);
  } else if (data.image_path || data.image_url) {
    images = [
      {
        id: "primary",
        product_id: data.id,
        image_path: data.image_path || data.image_url || "",
        sort_order: 0,
      },
    ];
  }

  return {
    id: data.id,
    farmer_clerk_id: data.farmer_clerk_id,
    category_id: data.category_id,
    name: data.name,
    description: data.description,
    price_per_unit: Number(data.price_per_unit),
    unit: data.unit,
    quantity_available: Number(data.quantity_available),
    min_order_quantity: Number(data.min_order_quantity),
    image_url: data.image_url,
    image_path: data.image_path,
    harvest_date: data.harvest_date,
    available_until: data.available_until,
    status: data.status as Product["status"],
    created_at: data.created_at,
    updated_at: data.updated_at,
    category: data.category ?? undefined,
    images,
  };
}

/**
 * Fetch all categories for filter UI.
 * Cached with Next.js unstable_cache (1 hour TTL) using the anonymous public Supabase client.
 */
export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, icon, description")
      .order("name");
    if (error) throw error;
    return (data ?? []) as Category[];
  },
  ["categories-list"],
  {
    revalidate: 3600,
    tags: ["categories"],
  }
);
