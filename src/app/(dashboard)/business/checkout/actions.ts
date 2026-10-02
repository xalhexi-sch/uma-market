"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertActiveProfile } from "@/lib/supabase/queries/profiles";
import { PlaceOrderSchema } from "@/lib/validation";
import { checkoutRateLimit } from "@/lib/rate-limit";
import {
  checkoutError,
  genericCheckoutError,
  mapCheckoutDatabaseError,
  mapCheckoutSchemaIssue,
} from "@/lib/checkout-errors";
import type { CheckoutError } from "@/lib/checkout-errors";

export interface PlaceOrderInput {
  farmerClerkId: string;
  fulfillmentType: "pickup" | "seller_delivery";
  deliveryAddress?: string;
  notes?: string;
  pickupDate?: string;
  items: Array<{ product_id: string; quantity: number }>;
}

export interface CheckoutOrderGroup {
  farmerClerkId: string;
  fulfillmentType: "pickup" | "seller_delivery";
  deliveryAddress?: string;
  notes?: string;
  pickupDate?: string;
  items: Array<{ product_id: string; quantity: number }>;
}

/**
 * Validates a pickup date and returns a stable error code instead of a message,
 * so no validation wording ever has to be re-derived downstream.
 */
function validatePickupDate(dateStr?: string): CheckoutError | null {
  if (!dateStr || typeof dateStr !== "string" || !dateStr.trim()) {
    return checkoutError("PICKUP_DATE_REQUIRED");
  }

  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return checkoutError("PICKUP_DATE_INVALID");
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return checkoutError("PICKUP_DATE_INVALID");
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return checkoutError("PICKUP_DATE_INVALID");
  }

  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  if (trimmed < todayStr) {
    return checkoutError("PICKUP_DATE_PAST");
  }

  return null;
}

/**
 * Place a multi-farmer (or single-farmer) checkout in a single atomic transaction.
 * Uses the place_checkout_orders RPC to guarantee all-or-nothing execution:
 * if any order group fails validation (stock, MOQ, farmer status, cart presence),
 * all orders roll back, preventing partial completion and duplicate retry risks.
 */
export async function placeMultiFarmerCheckout(orders: CheckoutOrderGroup[]): Promise<{
  success: boolean;
  orderIds?: string[];
  error?: CheckoutError;
}> {
  const { userId, sessionClaims } = await auth();

  if (!userId || sessionClaims?.user_role !== "business") {
    return { success: false, error: checkoutError("UNAUTHORIZED") };
  }

  const { active } = await assertActiveProfile(userId);
  if (!active) {
    return { success: false, error: checkoutError("ACCOUNT_INACTIVE") };
  }

  // Rate limit: 10 checkout attempts per minute
  const rateResult = checkoutRateLimit(userId);
  if (!rateResult.success) {
    return { success: false, error: checkoutError("RATE_LIMITED") };
  }

  // Validate input: each order group is validated on its own, because
  // PlaceOrderSchema requires farmerClerkId and fulfillmentType alongside items.
  // Validating a flattened { items } object alone omits those required fields and
  // always fails with "Invalid input: expected string, received undefined".
  // Only the issue PATH is mapped — never issue.message, which is Zod internals.
  for (const order of orders) {
    const parsed = PlaceOrderSchema.safeParse(order);
    if (!parsed.success) {
      return { success: false, error: mapCheckoutSchemaIssue(parsed.error.issues[0]) };
    }
  }

  if (orders.length === 0) {
    return { success: false, error: checkoutError("EMPTY_CART") };
  }

  // Validate pickup dates across all order groups
  for (const o of orders) {
    if (o.fulfillmentType === "pickup") {
      const dateError = validatePickupDate(o.pickupDate);
      if (dateError) {
        return { success: false, error: dateError };
      }
    }
  }

  const supabase = await createClient();

  const formattedOrders = orders.map((o) => {
    const isPickup = o.fulfillmentType === "pickup";
    return {
      farmer_clerk_id: o.farmerClerkId,
      fulfillment_type: o.fulfillmentType,
      delivery_address: isPickup ? null : (o.deliveryAddress ?? null),
      notes: o.notes ?? null,
      pickup_date: isPickup ? (o.pickupDate?.trim() ?? null) : null,
      items: o.items,
    };
  });

  const { data, error } = await supabase.rpc("place_checkout_orders", {
    p_orders: formattedOrders,
  });

  if (error) {
    console.error("[checkout] place_checkout_orders RPC error:", error.message);
    return { success: false, error: mapCheckoutDatabaseError(error.message) };
  }

  const orderIds = (data as { order_ids: string[] }).order_ids;
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    // Unexpected shape from the RPC — never surface it, collapse to a generic error.
    console.error("[checkout] place_checkout_orders returned no order ids");
    return { success: false, error: genericCheckoutError() };
  }

  revalidatePath("/business/cart");
  revalidatePath("/business/orders");
  revalidatePath("/business/products");
  return { success: true, orderIds };
}

/**
 * Place one order via the place_order RPC (atomic: creates order +
 * items + decrements stock + clears cart in one transaction).
 *
 * Preserved for backwards compatibility with single-order callers.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<{
  success: boolean;
  orderId?: string;
  error?: CheckoutError;
}> {
  const { userId, sessionClaims } = await auth();

  if (!userId || sessionClaims?.user_role !== "business") {
    return { success: false, error: checkoutError("UNAUTHORIZED") };
  }

  const { active } = await assertActiveProfile(userId);
  if (!active) {
    return { success: false, error: checkoutError("ACCOUNT_INACTIVE") };
  }

  if (input.items.length === 0) {
    return { success: false, error: checkoutError("EMPTY_CART") };
  }

  if (input.fulfillmentType === "pickup") {
    const dateError = validatePickupDate(input.pickupDate);
    if (dateError) {
      return { success: false, error: dateError };
    }
  }

  const isPickup = input.fulfillmentType === "pickup";
  const finalPickupDate = isPickup ? (input.pickupDate?.trim() || undefined) : undefined;
  const finalDeliveryAddress = isPickup ? undefined : (input.deliveryAddress || undefined);

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("place_order", {
    p_farmer_clerk_id: input.farmerClerkId,
    p_fulfillment_type: input.fulfillmentType,
    p_delivery_address: finalDeliveryAddress,
    p_notes: input.notes || undefined,
    p_pickup_date: finalPickupDate,
    p_items: input.items,
  });

  if (error) {
    console.error("[checkout] place_order RPC error:", error.message);
    return { success: false, error: mapCheckoutDatabaseError(error.message) };
  }

  const orderId = (data as { order_id: string }).order_id;
  if (!orderId) {
    console.error("[checkout] place_order returned no order id");
    return { success: false, error: genericCheckoutError() };
  }

  return { success: true, orderId };
}
