"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Cancel a pending order as a business buyer.
 *
 * Protected by:
 * 1. Server-side Clerk auth + role check
 * 2. Supabase RLS policy "orders: business cancels pending"
 *    (USING: sub = business_clerk_id AND status = 'pending')
 *    (WITH CHECK: sub = business_clerk_id AND status = 'cancelled')
 */
export async function cancelOrder(orderId: string) {
  const { userId, sessionClaims } = await auth();

  if (!userId || sessionClaims?.user_role !== "business") {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "Cancelled by buyer",
    })
    .eq("id", orderId)
    .eq("business_clerk_id", userId)
    .eq("status", "pending"); // Only pending orders can be cancelled

  if (error) {
    console.error("[orders] cancelOrder error:", error.message);
    return { success: false, error: "Could not cancel order. It may no longer be pending." };
  }

  revalidatePath("/business/orders");
  revalidatePath(`/business/orders/${orderId}`);
  revalidatePath("/farmer/orders");
  return { success: true };
}
