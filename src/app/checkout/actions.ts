"use server";

/**
 * UMA V4 — Checkout Server Action
 *
 * Places a multi-producer checkout using business context.
 * Cart is scoped by business_id, not individual user clerk_id.
 *
 * Authorization chain:
 *  1. Authenticated active user (Clerk)
 *  2. Active business membership (OWNER or STAFF)
 *  3. Business has can_buy capability
 *  4. RPC: place_v4_checkout_orders enforces in-database
 *
 * Reuses: pickup-date validation, checkout error mapping, checkout rate limiter.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCanBuy } from "@/platform/business-context";
import { PlaceOrderSchema } from "@/lib/validation";
import { checkoutRateLimit } from "@/lib/rate-limit";
import {
  checkoutError,
  genericCheckoutError,
  mapCheckoutDatabaseError,
  mapCheckoutSchemaIssue,
} from "@/lib/checkout-errors";
import type { CheckoutError } from "@/lib/checkout-errors";

export interface V4CheckoutOrderGroup {
  farmerClerkId: string;
  fulfillmentType: "pickup" | "seller_delivery";
  deliveryAddress?: string;
  notes?: string;
  pickupDate?: string;
  items: Array<{ product_id: string; quantity: number }>;
}

/**
 * Validates a pickup date and returns a stable error code.
 * Reuses the same logic as the legacy checkout.
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
 * Place a V4 multi-producer checkout using the active business context.
 *
 * The business_id is resolved server-side from the authenticated user's
 * active business — never provided by the client.
 */
export async function placeV4Checkout(orders: V4CheckoutOrderGroup[]): Promise<{
  success: boolean;
  orderIds?: string[];
  error?: CheckoutError;
}> {
  // 1. Authorization: authenticated + active business + can_buy
  let context;
  try {
    context = await requireCanBuy();
  } catch {
    return { success: false, error: checkoutError("UNAUTHORIZED") };
  }

  // 2. Rate limit (keyed by userId — shared budget with legacy checkout)
  const rateResult = checkoutRateLimit(context.user.userId);
  if (!rateResult.success) {
    return { success: false, error: checkoutError("RATE_LIMITED") };
  }

  // 3. Input validation
  if (orders.length === 0) {
    return { success: false, error: checkoutError("EMPTY_CART") };
  }

  for (const order of orders) {
    const parsed = PlaceOrderSchema.safeParse(order);
    if (!parsed.success) {
      return { success: false, error: mapCheckoutSchemaIssue(parsed.error.issues[0]) };
    }
  }

  // 4. Pickup date validation
  for (const o of orders) {
    if (o.fulfillmentType === "pickup") {
      const dateError = validatePickupDate(o.pickupDate);
      if (dateError) {
        return { success: false, error: dateError };
      }
    }
  }

  // 5. Build RPC payload
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

  // 6. Call V4 RPC — business_id is server-resolved, never client-provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not yet in generated types
  const supabase = await createClient() as any;
  const { data, error } = await supabase.rpc("place_v4_checkout_orders", {
    p_business_id: context.business.id,
    p_orders: formattedOrders,
  });

  if (error) {
    console.error("[v4-checkout] place_v4_checkout_orders RPC error:", error.message);
    return { success: false, error: mapCheckoutDatabaseError(error.message) };
  }

  const orderIds = (data as unknown as { order_ids: string[] }).order_ids;
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    console.error("[v4-checkout] place_v4_checkout_orders returned no order ids");
    return { success: false, error: genericCheckoutError() };
  }

  // 7. Revalidate V4 + legacy paths
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/business/cart");
  revalidatePath("/business/orders");
  return { success: true, orderIds };
}
