import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product, Category } from "@/lib/types";

export type ProductSort = "price_asc" | "price_desc" | "harvest_newest" | "newest" | "name_asc";

export interface ProductFilters {
  search?: string;
  categorySlug?: string;
  sort?: ProductSort;
  inStockOnly?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Fetch active products for marketplace and business browsing.
 * Uses server Supabase client with Clerk JWT when authenticated.
 * For unauthenticated visitors, enriches farmer provenance via the server-only admin client.
 */
export async function getActiveProducts({
  search,
  categorySlug,
  sort = "newest",
  inStockOnly = true,
  page = 1,
  limit = 24,
}: ProductFilters = {}): Promise<Product[]> {
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select(
      `
      id, farmer_clerk_id, category_id, name, description,
      price_per_unit, unit, quantity_available, min_order_quantity,
      image_url, image_path, harvest_date, available_until, status, created_at, updated_at,
      farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, avatar_url, bio, phone, is_verified),
      category:categories(id, name, slug)
    `
    )
    .eq("status", "active");

  if (inStockOnly) {
    query = query.gt("quantity_available", 0);
  }

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  switch (sort) {
    case "price_asc":
      query = query.order("price_per_unit", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price_per_unit", { ascending: false });
      break;
    case "harvest_newest":
      query = query.order("harvest_date", { ascending: false, nullsFirst: false });
      break;
    case "name_asc":
      query = query.order("name", { ascending: true });
      break;
    case "newest":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  query = query.range((page - 1) * limit, page * limit - 1);

  let { data, error } = await query;
  if (error) {
    try {
      const admin = createAdminClient();
      let fallbackQuery = admin
        .from("products")
        .select(
          `
          id, farmer_clerk_id, category_id, name, description,
          price_per_unit, unit, quantity_available, min_order_quantity,
          image_url, image_path, harvest_date, available_until, status, created_at, updated_at,
          farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, avatar_url, bio, phone, is_verified),
          category:categories(id, name, slug)
        `
        )
        .eq("status", "active");

      if (inStockOnly) {
        fallbackQuery = fallbackQuery.gt("quantity_available", 0);
      }
      if (search) {
        fallbackQuery = fallbackQuery.ilike("name", `%${search}%`);
      }
      switch (sort) {
        case "price_asc":
          fallbackQuery = fallbackQuery.order("price_per_unit", { ascending: true });
          break;
        case "price_desc":
          fallbackQuery = fallbackQuery.order("price_per_unit", { ascending: false });
          break;
        case "harvest_newest":
          fallbackQuery = fallbackQuery.order("harvest_date", { ascending: false, nullsFirst: false });
          break;
        case "name_asc":
          fallbackQuery = fallbackQuery.order("name", { ascending: true });
          break;
        case "newest":
        default:
          fallbackQuery = fallbackQuery.order("created_at", { ascending: false });
          break;
      }
      fallbackQuery = fallbackQuery.range((page - 1) * limit, page * limit - 1);
      const fallbackRes = await fallbackQuery;
      if (!fallbackRes.error && fallbackRes.data) {
        data = fallbackRes.data as unknown as typeof data;
        error = null;
      }
    } catch {
      // fallback attempt failed
    }
  }
  if (error) throw error;

  // Filter by category slug after join (PostgREST can't filter on joined cols without RPC)
  let products = (data ?? []) as unknown as Product[];
  if (categorySlug) {
    products = products.filter((p) => p.category?.slug === categorySlug);
  }

  // If unauthenticated or farmer viewer, RLS hides farmer profile from PostgREST join.
  // Enrich public farmer provenance on the server so visitors can see farm source.
  const missingFarmerIds = [
    ...new Set(
      products
        .filter((p) => !p.farmer)
        .map((p) => p.farmer_clerk_id)
        .filter(Boolean)
    ),
  ];

  if (missingFarmerIds.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: farmerProfiles } = await admin
        .from("profiles")
        .select("clerk_id, full_name, business_name, city, avatar_url, bio, is_verified")
        .in("clerk_id", missingFarmerIds);

      if (farmerProfiles && farmerProfiles.length > 0) {
        const profileMap = new Map(farmerProfiles.map((f) => [f.clerk_id, f]));
        products = products.map((p) => {
          if (!p.farmer && profileMap.has(p.farmer_clerk_id)) {
            return {
              ...p,
              farmer: profileMap.get(p.farmer_clerk_id) as Product["farmer"],
            };
          }
          return p;
        });
      }
    } catch {
      // Graceful fallback: return products as retrieved
    }
  }

  return products;
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
      farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, avatar_url, bio, phone, is_verified),
      category:categories(id, name, slug)
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
          farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, avatar_url, bio, phone, is_verified),
          category:categories(id, name, slug)
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

  if (product && !product.farmer && product.farmer_clerk_id) {
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
      category:categories(id, name, slug)
    `
    )
    .eq("id", id)
    .eq("farmer_clerk_id", farmerClerkId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Product | null;
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
