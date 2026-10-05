"use server";

import { revalidatePath } from "next/cache";
import { requireActiveBusiness } from "@/platform";
import { createClient } from "@/lib/supabase/server";

/**
 * Server action to update an incoming wholesale order's status.
 *
 * Security & Authorization:
 * 1. Requires authenticated active user and business membership.
 * 2. Requires SELL capability on the active business.
 * 3. Enforces that the order is assigned to this seller business (farmer_clerk_id).
 * 4. Delegates forward state machine transitions exclusively to the database RPC (update_order_status).
 */
export async function updateSellerOrderStatus(
  orderId: string,
  newStatus: string,
  cancellationReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await requireActiveBusiness();

    if (!context.canSell) {
      return {
        success: false,
        error: "Active business does not have selling capability to manage incoming orders.",
      };
    }

    const supabase = await createClient();

    // 1. Fetch order to verify seller ownership and identity
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, farmer_clerk_id, fulfillment_type")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError || !order) {
      return { success: false, error: "Order not found." };
    }

    // 2. Authorize that this order belongs to the active seller business
    const { data: members } = await supabase
      .from("business_members")
      .select("user_id")
      .eq("business_id", context.business.id);

    const allowedSellerIds = new Set(
      [
        context.business.legacy_clerk_id,
        context.user.userId,
        ...(members?.map((m) => m.user_id) ?? []),
      ].filter(Boolean)
    );

    if (!allowedSellerIds.has(order.farmer_clerk_id)) {
      return { success: false, error: "Not authorized to manage orders for another business." };
    }

    // 3. Delegate to the authoritative database RPC to enforce the state machine
    const { error: rpcError } = await supabase.rpc("update_order_status", {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_cancellation_reason: cancellationReason || undefined,
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard");
    revalidatePath("/orders");
    revalidatePath(`/orders/${orderId}`);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update order status.";
    return { success: false, error: message };
  }
}
