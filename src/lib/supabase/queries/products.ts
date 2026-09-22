import { createClient } from "@/lib/supabase/server";
import type { Product, Category } from "@/lib/types";

export interface ProductFilters {
  search?: string;
  categorySlug?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch active products for business browsing.
 * Uses server Supabase client — Clerk JWT authenticates the request.
 */
export async function getActiveProducts({
  search,
  categorySlug,
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
      image_url, harvest_date, available_until, status, created_at, updated_at,
      farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, avatar_url, bio, phone),
      category:categories(id, name, slug)
    `
    )
    .eq("status", "active")
    .gt("quantity_available", 0)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filter by category slug after join (PostgREST can't filter on joined cols without RPC)
  let products = (data ?? []) as unknown as Product[];
  if (categorySlug) {
    products = products.filter((p) => p.category?.slug === categorySlug);
  }

  return products;
}

/**
 * Fetch a single active product by ID, with farmer + category.
 */
export async function getProductById(id: string): Promise<Product | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, farmer_clerk_id, category_id, name, description,
      price_per_unit, unit, quantity_available, min_order_quantity,
      image_url, harvest_date, available_until, status, created_at, updated_at,
      farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, avatar_url, bio, phone),
      category:categories(id, name, slug)
    `
    )
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Product | null;
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
      image_url, harvest_date, available_until, status, created_at, updated_at,
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
      image_url, harvest_date, available_until, status, created_at, updated_at,
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
