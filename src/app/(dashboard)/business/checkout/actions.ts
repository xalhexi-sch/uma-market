"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertActiveProfile } from "@/lib/supabase/queries/profiles";
import { PlaceOrderSchema } from "@/lib/validation";
import { checkoutRateLimit } from "@/lib/rate-limit";

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

function validatePickupDate(dateStr?: string): { valid: boolean; error?: string } {
  if (!dateStr || typeof dateStr !== "string" || !dateStr.trim()) {
    return { valid: false, error: "Please select a pickup date." };
  }

  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return { valid: false, error: "Invalid pickup date format. Expected YYYY-MM-DD." };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, error: "Invalid calendar pickup date." };
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return { valid: false, error: "Invalid calendar pickup date." };
  }

  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  if (trimmed < todayStr) {
    return { valid: false, error: "Pickup date cannot be in the past." };
  }

  return { valid: true };
}

function mapCheckoutError(rawMessage: string): string {
  if (
    rawMessage.includes("was not found or has already been checked out") ||
    rawMessage.includes("was already checked out") ||
    rawMessage.includes("exceeds quantity in cart")
  ) {
    return "Your cart was modified or already checked out in another window. Please review your cart before placing an order.";
  }
  return rawMessage;
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
  error?: string;
}> {
  const { userId, sessionClaims } = await auth();

  if (!userId || sessionClaims?.user_role !== "business") {
    return { success: false, error: "Unauthorized" };
  }

  const { active, error: activeError } = await assertActiveProfile(userId);
  if (!active) {
    return { success: false, error: activeError ?? "Account is not active." };
  }

  // Rate limit: 10 checkout attempts per minute
  const rateResult = checkoutRateLimit(userId);
  if (!rateResult.success) {
    return { success: false, error: "Too many checkout attempts. Please wait a moment and try again." };
  }

  // Validate input
  const parsed = PlaceOrderSchema.safeParse({ items: orders.flatMap((o) => o.items) });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid checkout data." };
  }

  if (!orders || orders.length === 0) {
    return { success: false, error: "Checkout is empty." };
  }

  // Validate pickup dates across all order groups
  for (const o of orders) {
    if (o.fulfillmentType === "pickup") {
      const dateValidation = validatePickupDate(o.pickupDate);
      if (!dateValidation.valid) {
        return { success: false, error: dateValidation.error };
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
    return { success: false, error: mapCheckoutError(error.message) };
  }

  const orderIds = (data as { order_ids: string[] }).order_ids;

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
  error?: string;
}> {
  const { userId, sessionClaims } = await auth();

  if (!userId || sessionClaims?.user_role !== "business") {
    return { success: false, error: "Unauthorized" };
  }

  const { active, error: activeError } = await assertActiveProfile(userId);
  if (!active) {
    return { success: false, error: activeError ?? "Account is not active." };
  }

  if (input.items.length === 0) {
    return { success: false, error: "Cart is empty." };
  }

  if (input.fulfillmentType === "pickup") {
    const dateValidation = validatePickupDate(input.pickupDate);
    if (!dateValidation.valid) {
      return { success: false, error: dateValidation.error };
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
    // Surface the DB validation message (mapped if cart error)
    return { success: false, error: mapCheckoutError(error.message) };
  }

  const orderId = (data as { order_id: string }).order_id;
  return { success: true, orderId };
}
