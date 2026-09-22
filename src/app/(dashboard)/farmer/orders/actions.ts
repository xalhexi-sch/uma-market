"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Update the status of an order via the update_order_status RPC.
 * The RPC enforces:
 *  - Authentication
 *  - Role = farmer
 *  - Farmer owns the order (farmer_clerk_id = caller)
 *  - Valid state-machine transition
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  cancellationReason?: string
) {
  const { userId, sessionClaims } = await auth();

  if (!userId || sessionClaims?.user_role !== "farmer") {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("update_order_status", {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_cancellation_reason: cancellationReason ?? null,
  });

  if (error) {
    console.error("[orders] updateOrderStatus RPC error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/farmer/orders");
  revalidatePath(`/farmer/orders/${orderId}`);
  revalidatePath("/business/orders");
  return { success: true };
}
