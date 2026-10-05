"use server";

/**
 * V4 listing actions (/dashboard/listings).
 *
 * request → requireCanSell() (signed in, active profile, member of the active
 * business, business has SELL) → input validation → trusted RPC, which repeats
 * the membership/SELL checks and verifies the listing belongs to the business.
 *
 * The business is always the server-resolved active business; no business id,
 * owner id, stock or moderation value is accepted from the client.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAction } from "@/platform/actions";
import { AppError } from "@/platform/errors";
import { requireCanSell } from "@/platform/business-context";
import { routes } from "@/platform/routes";
import { ListingInputSchema, ListingStatusSchema, type ListingInput } from "@/lib/validation";
import { producerOpsError } from "@/lib/producer-ops-errors";
import { productCreateRateLimit } from "@/lib/rate-limit";
import type { ProductFormData } from "@/app/(dashboard)/farmer/products/actions";

const ProductIdSchema = z.string().uuid("Invalid listing.");

function revalidateListingPaths(productId?: string) {
  revalidatePath(routes.dashboard.listings);
  revalidatePath(routes.dashboard.inventory);
  revalidatePath(routes.dashboardRoot);
  revalidatePath(routes.products);
  if (productId) {
    revalidatePath(routes.product(productId));
    revalidatePath(routes.dashboard.editListing(productId));
  }
}

/** Maps the shared ProductForm payload onto the V4 listing contract. */
function parseListingForm(data: ProductFormData): ListingInput {
  if (!data || typeof data !== "object") {
    throw new AppError("VALIDATION", "Check the listing details and try again.");
  }

  const images =
    data.images ?? (data.image_path ? [{ image_path: data.image_path, sort_order: 0 }] : []);

  const parsed = ListingInputSchema.safeParse({
    name: data.name,
    category_id: data.category_id || null,
    description: data.description ?? "",
    price_per_unit: Number(data.price_per_unit),
    unit: data.unit,
    min_order_quantity: Number(data.min_order_quantity),
    quantity_available: Number(data.quantity_available),
    harvest_date: data.harvest_date || null,
    available_until: data.available_until || null,
    status: data.status,
    image_paths: [...images]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => image.image_path),
  });

  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message);
  }
  return parsed.data;
}

export const createListing = createAction(async (data: ProductFormData) => {
  const context = await requireCanSell();

  const rate = productCreateRateLimit(context.user.userId);
  if (!rate.success) {
    throw new AppError("RATE_LIMITED", "Too many listings created. Please wait before adding more.");
  }

  const input = parseListingForm(data);
  const supabase = await createClient();

  const { data: productId, error } = await supabase.rpc("create_business_listing", {
    p_business_id: context.business.id,
    p_name: input.name,
    p_category_id: input.category_id,
    p_description: input.description || null,
    p_price_per_unit: input.price_per_unit,
    p_unit: input.unit,
    p_min_order_quantity: input.min_order_quantity,
    p_opening_quantity: input.quantity_available,
    p_harvest_date: input.harvest_date,
    p_available_until: input.available_until,
    p_status: input.status,
    p_image_paths: input.image_paths,
  });

  if (error) throw producerOpsError(error);

  revalidateListingPaths(productId);
  return { productId };
});

/** Edits listing details. Stock is never written here — see adjustInventory. */
export const updateListing = createAction(async (productId: string, data: ProductFormData) => {
  const context = await requireCanSell();

  const id = ProductIdSchema.safeParse(productId);
  if (!id.success) throw new AppError("VALIDATION", "Invalid listing.");

  const input = parseListingForm(data);
  const supabase = await createClient();

  const { error } = await supabase.rpc("update_business_listing", {
    p_business_id: context.business.id,
    p_product_id: id.data,
    p_name: input.name,
    p_category_id: input.category_id,
    p_description: input.description || null,
    p_price_per_unit: input.price_per_unit,
    p_unit: input.unit,
    p_min_order_quantity: input.min_order_quantity,
    p_harvest_date: input.harvest_date,
    p_available_until: input.available_until,
    p_status: input.status,
    p_image_paths: input.image_paths,
  });

  if (error) throw producerOpsError(error);

  revalidateListingPaths(id.data);
});

async function applyListingStatus(productId: string, status: string) {
  const context = await requireCanSell();

  const parsed = ListingStatusSchema.safeParse({ productId, status });
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_business_listing_status", {
    p_business_id: context.business.id,
    p_product_id: parsed.data.productId,
    p_status: parsed.data.status,
  });

  if (error) throw producerOpsError(error);

  revalidateListingPaths(parsed.data.productId);
  return { status: data };
}

/** Publish (active), unpublish (draft), archive, or restore (draft) a listing. */
export const setListingStatus = createAction(
  async (productId: string, status: "active" | "draft" | "archived") =>
    applyListingStatus(productId, status)
);

/** Used by the shared ProductForm's archive button. */
export const archiveListing = createAction(async (productId: string) =>
  applyListingStatus(productId, "archived")
);
