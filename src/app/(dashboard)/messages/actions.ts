"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertActiveProfile } from "@/lib/supabase/queries/profiles";

/**
 * Send an order-threaded message.
 * Enforces authentication and relies on PostgreSQL RLS:
 * only buyer or farmer participating in the order can insert.
 */
export async function sendMessage(orderId: string, body: string) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  const { active, error: activeError } = await assertActiveProfile(userId);
  if (!active) {
    return { success: false, error: activeError ?? "Account is not active." };
  }

  const cleanBody = body.trim();
  if (!cleanBody) {
    return { success: false, error: "Message cannot be empty." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      order_id: orderId,
      sender_clerk_id: userId,
      body: cleanBody,
    })
    .select("id, order_id, sender_clerk_id, body, created_at")
    .single();

  if (error) {
    console.error("[messages] sendMessage error:", error.message);
    return { success: false, error: "Could not send message. Please verify you are part of this order." };
  }

  revalidatePath(`/business/orders/${orderId}`);
  revalidatePath(`/farmer/orders/${orderId}`);
  revalidatePath("/business/messages");
  revalidatePath("/farmer/messages");

  return { success: true, message: data };
}
