"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/supabase/storage";
import { assertActiveProfile } from "@/lib/supabase/queries/profiles";

async function assertFarmer(sessionClaims: Record<string, unknown> | null | undefined, userId: string | null) {
  if (!userId || sessionClaims?.user_role !== "farmer") {
    throw new Error("Unauthorized");
  }
  const { active } = await assertActiveProfile(userId);
  if (!active) {
    throw new Error("Account is not active.");
  }
}

export interface ProductImageInput {
  id?: string;
  image_path: string;
  sort_order: number;
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
  image_path?: string | null;
  images?: ProductImageInput[];
}

/**
 * Create a new product. The farmer_clerk_id is set server-side from the
 * authenticated user — the client cannot spoof it.
 */
export async function createProduct(data: ProductFormData) {
  const { userId, sessionClaims } = await auth();
  try {
    await assertFarmer(sessionClaims, userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return { success: false, error: msg };
  }

  if (!data.name.trim()) return { success: false, error: "Product name is required." };
  if (data.price_per_unit <= 0) return { success: false, error: "Price must be greater than 0." };
  if (data.quantity_available < 0) return { success: false, error: "Quantity cannot be negative." };
  if (data.min_order_quantity <= 0) return { success: false, error: "Minimum order must be greater than 0." };

  // Validate image paths belong to this farmer if provided
  if (data.image_path && !data.image_path.startsWith(`products/${userId}/`)) {
    return { success: false, error: "Invalid image path ownership." };
  }
  if (data.images && data.images.length > 0) {
    for (const img of data.images) {
      if (!img.image_path.startsWith(`products/${userId}/`)) {
        return { success: false, error: "Invalid image path ownership." };
      }
    }
  }

  // Authoritative primary image: first gallery image or fallback to image_path
  const primaryImagePath =
    data.images && data.images.length > 0
      ? data.images[0].image_path
      : data.image_path || null;

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
      image_path: primaryImagePath,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[products] createProduct error:", error.message);
    return { success: false, error: "Could not create product. Please try again." };
  }

  // Insert gallery items if provided
  if (data.images && data.images.length > 0) {
    const galleryRows = data.images.map((img, idx) => ({
      product_id: created.id,
      image_path: img.image_path,
      sort_order: idx,
    }));
    const { error: galleryError } = await supabase
      .from("product_images")
      .insert(galleryRows);
    if (galleryError) {
      console.error("[products] product_images insert error:", galleryError.message);
    }
  } else if (primaryImagePath) {
    await supabase.from("product_images").insert({
      product_id: created.id,
      image_path: primaryImagePath,
      sort_order: 0,
    });
  }

  revalidatePath("/farmer/products");
  revalidatePath("/business/products");
  revalidatePath("/products");
  revalidatePath("/");
  return { success: true, productId: created.id };
}

/**
 * Update a product. Explicit farmer_clerk_id filter + RLS.
 */
export async function updateProduct(productId: string, data: Partial<ProductFormData>) {
  const { userId, sessionClaims } = await auth();
  try {
    await assertFarmer(sessionClaims, userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return { success: false, error: msg };
  }

  // Validate image paths belong to this farmer if provided
  if (data.image_path && !data.image_path.startsWith(`products/${userId}/`)) {
    return { success: false, error: "Invalid image path ownership." };
  }
  if (data.images && data.images.length > 0) {
    for (const img of data.images) {
      if (!img.image_path.startsWith(`products/${userId}/`)) {
        return { success: false, error: "Invalid image path ownership." };
      }
    }
  }

  const supabase = await createClient();

  // If gallery images provided, derive primary image
  let primaryImagePath: string | null | undefined = undefined;
  if (data.images !== undefined) {
    primaryImagePath = data.images.length > 0 ? data.images[0].image_path : null;
  } else if (data.image_path !== undefined) {
    primaryImagePath = data.image_path || null;
  }

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) {
    if (!data.name.trim()) return { success: false, error: "Product name is required." };
    updates.name = data.name.trim();
  }
  if (data.category_id !== undefined) updates.category_id = data.category_id || null;
  if (data.description !== undefined) updates.description = data.description.trim() || null;
  if (data.price_per_unit !== undefined) {
    if (data.price_per_unit <= 0) return { success: false, error: "Price must be greater than 0." };
    updates.price_per_unit = data.price_per_unit;
  }
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.quantity_available !== undefined) {
    if (data.quantity_available < 0) return { success: false, error: "Quantity cannot be negative." };
    updates.quantity_available = data.quantity_available;
  }
  if (data.min_order_quantity !== undefined) {
    if (data.min_order_quantity <= 0) return { success: false, error: "Minimum order must be greater than 0." };
    updates.min_order_quantity = data.min_order_quantity;
  }
  if (data.harvest_date !== undefined) updates.harvest_date = data.harvest_date || null;
  if (data.available_until !== undefined) updates.available_until = data.available_until || null;
  if (data.status !== undefined) updates.status = data.status;
  if (primaryImagePath !== undefined) updates.image_path = primaryImagePath;

  const { error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", productId)
    .eq("farmer_clerk_id", userId!); // RLS + explicit check

  if (error) {
    console.error("[products] updateProduct error:", error.message);
    return { success: false, error: "Could not update product." };
  }

  // Handle gallery sync if data.images was provided
  if (data.images !== undefined) {
    // 1. Fetch current product_images for this product
    const { data: existingImages } = await supabase
      .from("product_images")
      .select("id, image_path, sort_order")
      .eq("product_id", productId);

    const existingList = existingImages || [];
    const newPathsSet = new Set(data.images.map((img) => img.image_path));
    const removedPaths = existingList
      .filter((img) => !newPathsSet.has(img.image_path))
      .map((img) => img.image_path);

    // 2. Delete removed images from product_images
    if (removedPaths.length > 0) {
      await supabase
        .from("product_images")
        .delete()
        .eq("product_id", productId)
        .in("image_path", removedPaths);

      // Safe deletion from Supabase Storage: only delete if not referenced elsewhere
      for (const path of removedPaths) {
        if (!path.startsWith(`products/${userId}/`)) continue;

        const { count: galleryRefs } = await supabase
          .from("product_images")
          .select("id", { count: "exact", head: true })
          .eq("image_path", path);

        const { count: prodRefs } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("image_path", path);

        if ((galleryRefs ?? 0) === 0 && (prodRefs ?? 0) === 0) {
          try {
            await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
          } catch (e) {
            console.warn("[storage] safe delete warning:", e);
          }
        }
      }
    }

    // 3. Upsert current images with updated sort_order
    if (data.images.length > 0) {
      const rows = data.images.map((img, idx) => ({
        product_id: productId,
        image_path: img.image_path,
        sort_order: idx,
      }));

      await supabase
        .from("product_images")
        .upsert(rows, { onConflict: "product_id, image_path" });
    }
  }

  revalidatePath("/farmer/products");
  revalidatePath(`/farmer/products/${productId}/edit`);
  revalidatePath("/business/products");
  revalidatePath(`/business/products/${productId}`);
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/");
  return { success: true };
}

/**
 * Archive a product (soft delete). Never hard-deletes to preserve order history.
 */
export async function archiveProduct(productId: string) {
  const { userId, sessionClaims } = await auth();
  try {
    await assertFarmer(sessionClaims, userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return { success: false, error: msg };
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
