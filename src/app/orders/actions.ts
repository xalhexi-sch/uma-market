"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveBusiness } from "@/platform/business-context";
import { routes } from "@/platform/routes";

/**
 * Cancel a pending order as a V4 buyer business member.
 * Protected by server-side active business membership check.
 */
export async function cancelBuyerOrder(orderId: string) {
  try {
    const context = await requireActiveBusiness();
    const supabase = await createClient();

    let query = supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: "Cancelled by buyer",
      })
      .eq("id", orderId)
      .eq("status", "pending");

    if (context.business.legacy_clerk_id) {
      query = query.or(`business_id.eq.${context.business.id},business_clerk_id.eq.${context.business.legacy_clerk_id}`);
    } else {
      query = query.eq("business_id", context.business.id);
    }

    const { data, error } = await query.select("id");

    if (error) {
      console.error("[orders] cancelBuyerOrder error:", error.message);
      return { success: false, error: "Could not cancel order. It may no longer be pending." };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: "Order could not be cancelled. It may no longer be pending or has already been processed.",
      };
    }

    revalidatePath(routes.orders);
    revalidatePath(routes.order(orderId));
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to cancel order.";
    return { success: false, error: message };
  }
}
