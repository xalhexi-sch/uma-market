import { createClient } from "@/lib/supabase/server";
import type { ProductStatus } from "@/lib/constants";
import type { Product } from "@/lib/types";
import { toBusinessListing, type BusinessListing, type ModerationStatus } from "@/lib/listings";

/**
 * V4 business listings (products owned by a business).
 *
 * Every query runs on the caller's RLS-scoped client. `businessId` must come
 * from the server-validated active business context, never from the request;
 * RLS ("products: seller members read business listings") additionally limits
 * rows to active SELL businesses the caller belongs to.
 */

/** A producer catalogue is small; one bounded round-trip serves counts, filters and sort. */
const LISTING_LIMIT = 500;

/** All listings of the business, most recently updated first, with derived stock state. */
export async function getBusinessListings(businessId: string): Promise<BusinessListing[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, name, status, moderation_status, price_per_unit, unit,
      quantity_available, min_order_quantity, image_path, image_url, updated_at,
      category:categories(id, name, slug)
    `
    )
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false })
    .limit(LISTING_LIMIT);

  if (error) throw error;

  return (data ?? []).map((row) =>
    toBusinessListing({
      id: row.id,
      name: row.name,
      status: row.status as ProductStatus,
      moderation_status: row.moderation_status as ModerationStatus,
      price_per_unit: Number(row.price_per_unit),
      unit: row.unit,
      quantity_available: Number(row.quantity_available),
      min_order_quantity: Number(row.min_order_quantity),
      image_path: row.image_path,
      image_url: row.image_url,
      updated_at: row.updated_at,
      category: row.category ?? null,
    })
  );
}

/**
 * One listing of the business, shaped for the shared ProductForm.
 * Returns null when the listing doesn't exist or belongs to another business.
 */
export async function getBusinessListingForEdit(
  businessId: string,
  productId: string
): Promise<(Product & { moderation_status: ModerationStatus }) | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, farmer_clerk_id, category_id, name, description,
      price_per_unit, unit, quantity_available, min_order_quantity,
      image_url, image_path, harvest_date, available_until, status, moderation_status,
      created_at, updated_at,
      category:categories(id, name, slug),
      images:product_images(id, product_id, image_path, sort_order)
    `
    )
    .eq("id", productId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  let images: Product["images"] = [];
  if (data.images && data.images.length > 0) {
    images = [...data.images].sort((a, b) => a.sort_order - b.sort_order);
  } else if (data.image_path) {
    images = [{ id: "primary", product_id: data.id, image_path: data.image_path, sort_order: 0 }];
  }

  return {
    id: data.id,
    farmer_clerk_id: data.farmer_clerk_id,
    category_id: data.category_id,
    name: data.name,
    description: data.description,
    price_per_unit: Number(data.price_per_unit),
    unit: data.unit,
    quantity_available: Number(data.quantity_available),
    min_order_quantity: Number(data.min_order_quantity),
    image_url: data.image_url,
    image_path: data.image_path,
    harvest_date: data.harvest_date,
    available_until: data.available_until,
    status: data.status as ProductStatus,
    moderation_status: data.moderation_status as ModerationStatus,
    created_at: data.created_at,
    updated_at: data.updated_at,
    category: data.category ?? undefined,
    images,
  };
}
