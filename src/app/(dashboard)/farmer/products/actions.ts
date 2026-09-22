"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function assertFarmer(sessionClaims: Record<string, unknown> | null | undefined, userId: string | null) {
  if (!userId || sessionClaims?.user_role !== "farmer") {
    throw new Error("Unauthorized");
  }
}

export interface ProductFormData {
  name: string;
  category_id: string;
  description: string;
  price_per_unit: number;
  unit: string;
  quantity_available: number;
  min_order_quantity: number;
  harvest_date: string;
  available_until: string;
  status: "active" | "draft";
}

/**
 * Create a new product. The farmer_clerk_id is set server-side from the
 * authenticated user — the client cannot spoof it.
 */
export async function createProduct(data: ProductFormData) {
  const { userId, sessionClaims } = await auth();
  try {
    assertFarmer(sessionClaims, userId);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  if (!data.name.trim()) return { success: false, error: "Product name is required." };
  if (data.price_per_unit <= 0) return { success: false, error: "Price must be greater than 0." };
  if (data.quantity_available < 0) return { success: false, error: "Quantity cannot be negative." };
  if (data.min_order_quantity <= 0) return { success: false, error: "Minimum order must be greater than 0." };

  const supabase = await createClient();

  const { data: created, error } = await supabase
    .from("products")
    .insert({
      farmer_clerk_id: userId!,
      name: data.name.trim(),
      category_id: data.category_id || null,
      description: data.description.trim() || null,
      price_per_unit: data.price_per_unit,
      unit: data.unit,
      quantity_available: data.quantity_available,
      min_order_quantity: data.min_order_quantity,
      harvest_date: data.harvest_date || null,
      available_until: data.available_until || null,
      status: data.status,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[products] createProduct error:", error.message);
    return { success: false, error: "Could not create product. Please try again." };
  }

  revalidatePath("/farmer/products");
  revalidatePath("/business/products");
  return { success: true, productId: created.id };
}

/**
 * Update a product. Explicit farmer_clerk_id filter + RLS.
 */
export async function updateProduct(productId: string, data: Partial<ProductFormData>) {
  const { userId, sessionClaims } = await auth();
  try {
    assertFarmer(sessionClaims, userId);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.category_id !== undefined) updates.category_id = data.category_id || null;
  if (data.description !== undefined) updates.description = data.description.trim() || null;
  if (data.price_per_unit !== undefined) updates.price_per_unit = data.price_per_unit;
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.quantity_available !== undefined) updates.quantity_available = data.quantity_available;
  if (data.min_order_quantity !== undefined) updates.min_order_quantity = data.min_order_quantity;
  if (data.harvest_date !== undefined) updates.harvest_date = data.harvest_date || null;
  if (data.available_until !== undefined) updates.available_until = data.available_until || null;
  if (data.status !== undefined) updates.status = data.status;

  const { error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", productId)
    .eq("farmer_clerk_id", userId!); // RLS + explicit check

  if (error) {
    console.error("[products] updateProduct error:", error.message);
    return { success: false, error: "Could not update product." };
  }

  revalidatePath("/farmer/products");
  revalidatePath(`/farmer/products/${productId}/edit`);
  revalidatePath("/business/products");
  return { success: true };
}

/**
 * Archive a product (soft delete). Never hard-deletes to preserve order history.
 */
export async function archiveProduct(productId: string) {
  const { userId, sessionClaims } = await auth();
  try {
    assertFarmer(sessionClaims, userId);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({ status: "archived" })
    .eq("id", productId)
    .eq("farmer_clerk_id", userId!);

  if (error) return { success: false, error: "Could not archive product." };

  revalidatePath("/farmer/products");
  revalidatePath("/business/products");
  return { success: true };
}
