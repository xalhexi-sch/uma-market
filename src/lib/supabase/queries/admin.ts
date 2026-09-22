import { createAdminClient } from "@/lib/supabase/admin";
import type { Product, Order, Profile } from "@/lib/types";

export interface AdminMetrics {
  totalFarmers: number;
  totalBusinesses: number;
  totalProducts: number;
  totalOrders: number;
  totalVolume: number;
}

/**
 * Fetch platform-wide statistics for the admin dashboard.
 * Uses createAdminClient() (server-only, bypasses RLS for cross-tenant aggregates).
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const supabase = createAdminClient();

  const [farmersRes, bizRes, productsRes, ordersRes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "farmer"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "business"),
    supabase.from("products").select("*", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("orders").select("total_amount"),
  ]);

  const orders = ordersRes.data ?? [];
  const totalVolume = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  return {
    totalFarmers: farmersRes.count ?? 0,
    totalBusinesses: bizRes.count ?? 0,
    totalProducts: productsRes.count ?? 0,
    totalOrders: orders.length,
    totalVolume,
  };
}

/**
 * Fetch all products platform-wide for admin moderation.
 */
export async function getAdminProducts(): Promise<Product[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("products")
    .select(`
      id, farmer_clerk_id, category_id, name, description,
      price_per_unit, unit, quantity_available, min_order_quantity,
      image_url, harvest_date, available_until, status, created_at, updated_at,
      farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city),
      category:categories(id, name, slug)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] getAdminProducts error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as Product[];
}

/**
 * Fetch all orders platform-wide for admin auditing.
 */
export async function getAdminOrders(): Promise<Order[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      farmer:profiles!orders_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city),
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city),
      items:order_items(id, product_id, product_name, unit, quantity, unit_price, subtotal)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] getAdminOrders error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as Order[];
}

/**
 * Fetch all registered profiles by role for admin user directory.
 */
export async function getAdminProfiles(role?: "farmer" | "business"): Promise<Profile[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (role) {
    query = query.eq("role", role);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[admin] getAdminProfiles error:", error.message);
    return [];
  }

  return (data ?? []) as Profile[];
}

