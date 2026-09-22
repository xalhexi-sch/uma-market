import { createClient } from "@/lib/supabase/server";
import type { CartItem } from "@/lib/types";

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
        farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city),
        category:categories(id, name, slug)
      )
    `
    )
    .eq("business_clerk_id", businessClerkId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as CartItem[];
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
