"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertActiveProfile } from "@/lib/supabase/queries/profiles";

/**
 * Cancel a pending order as a business buyer.
 *
 * Protected by:
 * 1. Server-side Clerk auth + role check
 * 2. Supabase RLS policy "orders: business cancels pending"
 *    (USING: pending AND (legacy identity OR business_members membership))
 *    (WITH CHECK: cancelled AND (legacy identity OR business_members membership))
 *
 * Row scoping is delegated to RLS (the declared authorization boundary):
 * membership resolves both V4 rows (business_id) and legacy rows
 * (business_clerk_id), so no caller-identity filter is applied here.
 */
export async function cancelOrder(orderId: string) {
  const { userId, sessionClaims } = await auth();

  if (!userId || sessionClaims?.user_role !== "business") {
    return { success: false, error: "Unauthorized" };
  }

  const { active, error: activeError } = await assertActiveProfile(userId);
  if (!active) {
    return { success: false, error: activeError ?? "Account is not active." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "Cancelled by buyer",
    })
    .eq("id", orderId)
    .eq("status", "pending") // Only pending orders can be cancelled
    .select("id");

  if (error) {
    console.error("[orders] cancelOrder error:", error.message);
    return { success: false, error: "Could not cancel order. It may no longer be pending." };
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      error: "Order could not be cancelled. It may no longer be pending or has already been processed.",
    };
  }

  revalidatePath("/business/orders");
  revalidatePath(`/business/orders/${orderId}`);
  revalidatePath("/farmer/orders");
  return { success: true };
}
