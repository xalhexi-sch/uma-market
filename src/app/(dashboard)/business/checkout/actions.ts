"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

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
 * Place a multi-farmer (or single-farmer) checkout in a single atomic transaction.
 * Uses the place_checkout_orders RPC to guarantee all-or-nothing execution:
 * if any order group fails validation (stock, MOQ, farmer status), all orders
 * roll back, preventing partial completion and duplicate retry risks.
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

  if (!orders || orders.length === 0) {
    return { success: false, error: "Checkout is empty." };
  }

  const supabase = await createClient();

  const formattedOrders = orders.map((o) => ({
    farmer_clerk_id: o.farmerClerkId,
    fulfillment_type: o.fulfillmentType,
    delivery_address: o.deliveryAddress ?? null,
    notes: o.notes ?? null,
    pickup_date: o.pickupDate ?? null,
    items: o.items,
  }));

  const { data, error } = await supabase.rpc("place_checkout_orders", {
    p_orders: formattedOrders,
  });

  if (error) {
    console.error("[checkout] place_checkout_orders RPC error:", error.message);
    return { success: false, error: error.message };
  }

  const orderIds = (data as { order_ids: string[] }).order_ids;
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

  if (input.items.length === 0) {
    return { success: false, error: "Cart is empty." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("place_order", {
    p_farmer_clerk_id: input.farmerClerkId,
    p_fulfillment_type: input.fulfillmentType,
    p_delivery_address: input.deliveryAddress ?? null,
    p_notes: input.notes ?? null,
    p_pickup_date: input.pickupDate ?? null,
    p_items: input.items,
  });

  if (error) {
    console.error("[checkout] place_order RPC error:", error.message);
    // Surface the DB validation message (written to be user-readable)
    return { success: false, error: error.message };
  }

  const orderId = (data as { order_id: string }).order_id;
  return { success: true, orderId };
}
