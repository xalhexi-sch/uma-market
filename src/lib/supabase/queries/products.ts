import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product, Category } from "@/lib/types";

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

interface SearchProductsRpcRow {
  id: string;
  farmer_clerk_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_per_unit: number;
  unit: string;
  quantity_available: number;
  min_order_quantity: number;
  image_url: string | null;
  image_path: string | null;
  harvest_date: string | null;
  available_until: string | null;
  status: Product["status"];
  created_at: string;
  updated_at: string;
  category: Product["category"];
  farmer: Product["farmer"];
  images: Product["images"];
  search_rank: number;
  total_count: number | string;
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
    p_search: search?.trim() || null,
    p_category_slug: categorySlug?.trim() || null,
    p_in_stock_only: inStockOnly,
    p_sort: effectiveSort,
    p_limit: limit,
    p_offset: offset,
  };

  let { data, error } = await supabase.rpc("search_products", rpcParams);

  if (error) {
    try {
      const admin = createAdminClient();
      const fallbackRes = await admin.rpc("search_products", rpcParams);
      if (!fallbackRes.error && fallbackRes.data) {
        data = fallbackRes.data;
        error = null;
      }
    } catch {
      // Fallback failed
    }
  }

  if (error) throw error;

  const rawRows = (data ?? []) as unknown as SearchProductsRpcRow[];
  const totalCount = rawRows.length > 0 ? Number(rawRows[0].total_count) : 0;
  const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1;

  const products: Product[] = rawRows.map((row) => {
    let images = row.images ?? [];
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
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category: row.category,
      farmer: row.farmer,
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
 * Fetch a single active product by ID, with farmer + category.
 */
export async function getProductById(id: string): Promise<Product | null> {
  const supabase = await createClient();

  let { data, error } = await supabase
    .from("products")
    .select(
      `
      id, farmer_clerk_id, category_id, name, description,
      price_per_unit, unit, quantity_available, min_order_quantity,
      image_url, image_path, harvest_date, available_until, status, created_at, updated_at,
      farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, avatar_url, bio, is_verified),
      category:categories(id, name, slug),
      images:product_images(id, product_id, image_path, sort_order)
    `
    )
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    try {
      const admin = createAdminClient();
      const fallbackRes = await admin
        .from("products")
        .select(
          `
          id, farmer_clerk_id, category_id, name, description,
          price_per_unit, unit, quantity_available, min_order_quantity,
          image_url, image_path, harvest_date, available_until, status, created_at, updated_at,
          farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, avatar_url, bio, is_verified),
          category:categories(id, name, slug),
          images:product_images(id, product_id, image_path, sort_order)
        `
        )
        .eq("id", id)
        .eq("status", "active")
        .maybeSingle();
      if (!fallbackRes.error && fallbackRes.data) {
        data = fallbackRes.data as unknown as typeof data;
        error = null;
      }
    } catch {
      // fallback attempt failed
    }
  }

  if (error) throw error;
  const product = data as unknown as Product | null;

  if (product) {
    // Normalize and sort images
    if (product.images && product.images.length > 0) {
      product.images.sort((a, b) => a.sort_order - b.sort_order);
    } else if (product.image_path || product.image_url) {
      product.images = [
        {
          id: "primary",
          product_id: product.id,
          image_path: product.image_path || product.image_url || "",
          sort_order: 0,
        },
      ];
    } else {
      product.images = [];
    }

    if (!product.farmer && product.farmer_clerk_id) {
      try {
        const admin = createAdminClient();
        const { data: farmerProfile } = await admin
          .from("profiles")
          .select("clerk_id, full_name, business_name, city, avatar_url, bio, is_verified")
          .eq("clerk_id", product.farmer_clerk_id)
          .maybeSingle();

        if (farmerProfile) {
          product.farmer = farmerProfile as Product["farmer"];
        }
      } catch {
        // Graceful fallback
      }
    }
  }

  return product;
}

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
  return (data ?? []) as unknown as Product[];
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
  const product = data as unknown as Product | null;
  if (product) {
    if (product.images && product.images.length > 0) {
      product.images.sort((a, b) => a.sort_order - b.sort_order);
    } else if (product.image_path || product.image_url) {
      product.images = [
        {
          id: "primary",
          product_id: product.id,
          image_path: product.image_path || product.image_url || "",
          sort_order: 0,
        },
      ];
    } else {
      product.images = [];
    }
  }
  return product;
}

/**
 * Fetch all categories for filter UI.
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, icon, description")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
}
