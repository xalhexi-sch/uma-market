import { createClient } from "@/lib/supabase/server";
import type { ReviewEntry, ReviewSummary } from "@/lib/types";

const EMPTY_SUMMARY: ReviewSummary = { averageRating: 0, reviewCount: 0 };

function toReview(row: {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}): ReviewEntry {
  return {
    id: row.id,
    rating: Number(row.rating),
    comment: row.comment,
    created_at: row.created_at,
    verified: true,
  };
}

/** Public, aggregate-only seller reputation query. */
export async function getSellerReviewSummary(farmerClerkId: string): Promise<ReviewSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_seller_review_summary", {
    p_farmer_clerk_id: farmerClerkId,
  });

  if (error) {
    console.error("[reviews] getSellerReviewSummary error:", error.message);
    return EMPTY_SUMMARY;
  }
  const summary = data as { average_rating?: number; review_count?: number } | null;
  return {
    averageRating: Number(summary?.average_rating ?? 0),
    reviewCount: Number(summary?.review_count ?? 0),
  };
}

/** Public seller review list. The reviewer identity is intentionally omitted. */
export async function getSellerReviews(farmerClerkId: string, limit = 5): Promise<ReviewEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seller_reviews")
    .select("id, rating, comment, created_at")
    .eq("target_farmer_clerk_id", farmerClerkId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20));

  if (error) {
    console.error("[reviews] getSellerReviews error:", error.message);
    return [];
  }
  return (data ?? []).map(toReview);
}

/** Public product reputation query. */
export async function getProductReviewSummary(productId: string): Promise<ReviewSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_product_review_summary", {
    p_product_id: productId,
  });

  if (error) {
    console.error("[reviews] getProductReviewSummary error:", error.message);
    return EMPTY_SUMMARY;
  }
  const summary = data as { average_rating?: number; review_count?: number } | null;
  return {
    averageRating: Number(summary?.average_rating ?? 0),
    reviewCount: Number(summary?.review_count ?? 0),
  };
}

/** Public product review list. Every returned row is transaction-backed. */
export async function getProductReviews(productId: string, limit = 5): Promise<ReviewEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, rating, comment, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20));

  if (error) {
    console.error("[reviews] getProductReviews error:", error.message);
    return [];
  }
  return (data ?? []).map(toReview);
}

export async function getOrderReviewStatus(orderId: string, businessClerkId: string) {
  const supabase = await createClient();
  const [{ data: seller }, { data: products }] = await Promise.all([
    supabase
      .from("seller_reviews")
      .select("id")
      .eq("order_id", orderId)
      .eq("reviewer_clerk_id", businessClerkId)
      .maybeSingle(),
    supabase
      .from("product_reviews")
      .select("order_item_id")
      .eq("order_id", orderId)
      .eq("reviewer_clerk_id", businessClerkId),
  ]);

  return {
    sellerReviewed: Boolean(seller),
    reviewedProductItemIds: (products ?? []).map((row) => row.order_item_id),
  };
}
