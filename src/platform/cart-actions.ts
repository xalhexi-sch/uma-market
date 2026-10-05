"use server";

/**
 * UMA Platform — V4 Business Cart Actions
 *
 * Implements server-side, RLS-backed cart actions scoped to the active business.
 * Enforces:
 *  - Authenticated active user
 *  - Active business membership (OWNER or STAFF)
 *  - BUY capability on the business (can_buy === true)
 *  - Stock, status, and MOQ constraints
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCanBuy } from "@/platform/business-context";

/**
 * Add a product to the active business's cart.
 */
export async function addToBusinessCart(
  productId: string,
  quantity: number,
  preferredBusinessId?: string | null
) {
  const context = await requireCanBuy(preferredBusinessId);

  if (quantity <= 0) {
    return { success: false, error: "Quantity must be greater than zero." };
  }

  const supabase = await createClient();

  // Verify product is active and check quantities
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, status, quantity_available, min_order_quantity, unit")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (productError || !product) {
    return { success: false, error: "Product not found or unavailable." };
  }
  if (quantity < product.min_order_quantity) {
    return {
      success: false,
      error: `Minimum order is ${product.min_order_quantity} ${product.unit}.`,
    };
  }
  if (quantity > product.quantity_available) {
    return {
      success: false,
      error: `Only ${product.quantity_available} ${product.unit} available.`,
    };
  }

  const { error } = await supabase.from("cart_items").upsert(
    {
      business_id: context.business.id,
      business_clerk_id: context.user.userId,
      product_id: productId,
      quantity,
    },
    { onConflict: "business_id,product_id" }
  );

  if (error) {
    console.error("[cart-actions] addToBusinessCart error:", error.message);
    return { success: false, error: "Could not add to cart. Please try again." };
  }

  revalidatePath("/cart");
  revalidatePath("/products");
  return { success: true, productName: product.name, businessId: context.business.id };
}

/**
 * Update the quantity of a cart item in the active business's cart.
 */
export async function updateBusinessCartItemQuantity(
  cartItemId: string,
  quantity: number,
  preferredBusinessId?: string | null
) {
  const context = await requireCanBuy(preferredBusinessId);

  if (quantity <= 0) {
    return removeFromBusinessCart(cartItemId, preferredBusinessId);
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("id", cartItemId)
    .eq("business_id", context.business.id);

  if (error) {
    return { success: false, error: "Could not update quantity." };
  }

  revalidatePath("/cart");
  return { success: true };
}

/**
 * Remove an item from the active business's cart.
 */
export async function removeFromBusinessCart(
  cartItemId: string,
  preferredBusinessId?: string | null
) {
  const context = await requireCanBuy(preferredBusinessId);

  const supabase = await createClient();

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", cartItemId)
    .eq("business_id", context.business.id);

  if (error) {
    return { success: false, error: "Could not remove item." };
  }

  revalidatePath("/cart");
  return { success: true };
}
