import { createClient } from "@/lib/supabase/server";
import type { CartItem, Product } from "@/lib/types";

/**
 * Fetch cart items for a business user, with joined product + farmer.
 */
export async function getCartItems(businessClerkId: string): Promise<CartItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cart_items")
    .select(
      `
      id, business_clerk_id, product_id, quantity, created_at, updated_at,
      product:products(
        id, farmer_clerk_id, name, price_per_unit, unit, quantity_available,
        min_order_quantity, image_url, status,
        farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, avatar_url, bio, is_verified),
        category:categories(id, name, slug)
      )
    `
    )
    .eq("business_clerk_id", businessClerkId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row): CartItem => ({
    id: row.id,
    business_clerk_id: row.business_clerk_id,
    product_id: row.product_id,
    quantity: row.quantity,
    created_at: row.created_at,
    updated_at: row.updated_at,
    product: row.product
      ? {
          id: row.product.id,
          farmer_clerk_id: row.product.farmer_clerk_id,
          category_id: null,
          name: row.product.name,
          description: null,
          price_per_unit: Number(row.product.price_per_unit),
          unit: row.product.unit,
          quantity_available: Number(row.product.quantity_available),
          min_order_quantity: Number(row.product.min_order_quantity),
          image_url: row.product.image_url,
          image_path: null,
          harvest_date: null,
          available_until: null,
          status: row.product.status as Product["status"],
          created_at: row.created_at,
          updated_at: row.updated_at,
          farmer: row.product.farmer ?? undefined,
          category: row.product.category ?? undefined,
        }
      : undefined,
  }));
}

/**
 * Fetch count of cart items for sidebar badge.
 */
export async function getCartItemCount(businessClerkId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("cart_items")
    .select("*", { count: "exact", head: true })
    .eq("business_clerk_id", businessClerkId);
  if (error) return 0;
  return count ?? 0;
}
