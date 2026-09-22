"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

interface PlaceOrderInput {
  farmerClerkId: string;
  fulfillmentType: "pickup" | "seller_delivery";
  deliveryAddress?: string;
  notes?: string;
  pickupDate?: string;
  items: Array<{ product_id: string; quantity: number }>;
}

/**
 * Place one order via the place_order RPC (atomic: creates order +
 * items + decrements stock + clears cart in one transaction).
 *
 * Returns the new order ID on success.
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
