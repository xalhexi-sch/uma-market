"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertActiveProfile } from "@/lib/supabase/queries/profiles";
import {
  CreateProductReviewSchema,
  CreateSellerReviewSchema,
} from "@/lib/validation";
import { reviewRateLimit } from "@/lib/rate-limit";

const REVIEW_RATE_LIMIT_ERROR = "Too many review attempts. Please wait a moment and try again.";

function safeReviewError(message: string) {
  if (message.includes("duplicate key") || message.includes("already exists")) {
    return "You have already reviewed this completed order item.";
  }
  return "Review could not be submitted. Please try again.";
}

export async function createSellerReview(input: unknown) {
  const parsed = CreateSellerReviewSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid review." };

  const { userId, sessionClaims } = await auth();
  if (!userId || sessionClaims?.user_role !== "business") return { success: false, error: "Unauthorized." };
  const { active, error: profileError } = await assertActiveProfile(userId);
  if (!active) return { success: false, error: profileError ?? "Account is not active." };

  // Rate limit: 10 review submissions per minute, shared by both review types.
  const rateResult = reviewRateLimit(userId);
  if (!rateResult.success) return { success: false, error: REVIEW_RATE_LIMIT_ERROR };

  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, farmer_clerk_id, status")
    .eq("id", parsed.data.orderId)
    .eq("business_clerk_id", userId)
    .maybeSingle();

  if (orderError || !order || order.status !== "completed") {
    return { success: false, error: "Only your completed orders can be reviewed." };
  }

  const { error } = await supabase.from("seller_reviews").insert({
    order_id: order.id,
    reviewer_clerk_id: userId,
    target_farmer_clerk_id: order.farmer_clerk_id,
    rating: parsed.data.rating,
    comment: parsed.data.comment?.trim() || null,
  });

  if (error) {
    console.error("[reviews] createSellerReview error:", error.message);
    return { success: false, error: safeReviewError(error.message) };
  }

  revalidatePath(`/business/orders/${order.id}`);
  revalidatePath(`/farmers/${order.farmer_clerk_id}`);
  return { success: true };
}

export async function createProductReview(input: unknown) {
  const parsed = CreateProductReviewSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid review." };

  const { userId, sessionClaims } = await auth();
  if (!userId || sessionClaims?.user_role !== "business") return { success: false, error: "Unauthorized." };
  const { active, error: profileError } = await assertActiveProfile(userId);
  if (!active) return { success: false, error: profileError ?? "Account is not active." };

  // Rate limit: 10 review submissions per minute, shared by both review types.
  const rateResult = reviewRateLimit(userId);
  if (!rateResult.success) return { success: false, error: REVIEW_RATE_LIMIT_ERROR };

  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", parsed.data.orderId)
    .eq("business_clerk_id", userId)
    .maybeSingle();

  if (orderError || !order || order.status !== "completed") {
    return { success: false, error: "Only your completed orders can be reviewed." };
  }

  const { data: item, error: itemError } = await supabase
    .from("order_items")
    .select("id, product_id")
    .eq("id", parsed.data.orderItemId)
    .eq("order_id", order.id)
    .maybeSingle();

  if (itemError || !item) return { success: false, error: "That product was not part of this completed order." };

  const { error } = await supabase.from("product_reviews").insert({
    order_id: order.id,
    order_item_id: item.id,
    reviewer_clerk_id: userId,
    product_id: item.product_id,
    rating: parsed.data.rating,
    comment: parsed.data.comment?.trim() || null,
  });

  if (error) {
    console.error("[reviews] createProductReview error:", error.message);
    return { success: false, error: safeReviewError(error.message) };
  }

  revalidatePath(`/business/orders/${order.id}`);
  revalidatePath(`/products/${item.product_id}`);
  return { success: true };
}
