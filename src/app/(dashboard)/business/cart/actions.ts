"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Add a product to the business user's cart.
 * Upserts: if the product is already in cart, replaces quantity.
 */
export async function addToCart(productId: string, quantity: number) {
  const { userId, sessionClaims } = await auth();
  if (!userId || sessionClaims?.user_role !== "business") {
    return { success: false, error: "Unauthorized" };
  }

  if (quantity <= 0) {
    return { success: false, error: "Quantity must be greater than zero." };
  }

  const supabase = await createClient();

  // Verify product is active and quantity is available
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
      business_clerk_id: userId,
      product_id: productId,
      quantity,
    },
    { onConflict: "business_clerk_id,product_id" }
  );

  if (error) {
    console.error("[cart] addToCart error:", error.message);
    return { success: false, error: "Could not add to cart. Please try again." };
  }

  revalidatePath("/business/cart");
  revalidatePath("/business/products");
  return { success: true, productName: product.name };
}

/**
 * Update the quantity of a cart item.
 */
export async function updateCartItemQuantity(cartItemId: string, quantity: number) {
  const { userId, sessionClaims } = await auth();
  if (!userId || sessionClaims?.user_role !== "business") {
    return { success: false, error: "Unauthorized" };
  }

  if (quantity <= 0) {
    return removeFromCart(cartItemId);
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("id", cartItemId)
    .eq("business_clerk_id", userId); // RLS + explicit ownership check

  if (error) {
    return { success: false, error: "Could not update quantity." };
  }

  revalidatePath("/business/cart");
  return { success: true };
}

/**
 * Remove a cart item.
 */
export async function removeFromCart(cartItemId: string) {
  const { userId, sessionClaims } = await auth();
  if (!userId || sessionClaims?.user_role !== "business") {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", cartItemId)
    .eq("business_clerk_id", userId); // RLS + explicit ownership check

  if (error) {
    return { success: false, error: "Could not remove item." };
  }

  revalidatePath("/business/cart");
  return { success: true };
}
