"use client";

import { useState } from "react";
import { RiCheckLine, RiStarLine } from "@remixicon/react";
import { ReviewForm } from "@/components/reviews/review-form";
import { createProductReview, createSellerReview } from "@/app/(dashboard)/business/orders/review-actions";
import type { OrderItem } from "@/lib/types";

interface OrderReviewPanelProps {
  orderId: string;
  farmerName: string;
  items: OrderItem[];
  sellerReviewed: boolean;
  reviewedProductItemIds: string[];
}

export function OrderReviewPanel({
  orderId,
  farmerName,
  items,
  sellerReviewed: initialSellerReviewed,
  reviewedProductItemIds: initialReviewedProductItemIds,
}: OrderReviewPanelProps) {
  const [sellerReviewed, setSellerReviewed] = useState(initialSellerReviewed);
  const [reviewedProductItemIds, setReviewedProductItemIds] = useState(initialReviewedProductItemIds);
  const [openReview, setOpenReview] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-start gap-3">
        <RiStarLine className="mt-0.5 size-5 shrink-0 text-amber-500" />
        <div>
          <h2 className="font-semibold text-foreground">How was this order?</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Your verified feedback helps other businesses source with confidence.</p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-border">
        <div className="py-4 first:pt-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Review {farmerName}</p>
              <p className="text-xs text-muted-foreground">Seller review · Verified Order</p>
            </div>
            {sellerReviewed ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><RiCheckLine className="size-4" /> Reviewed</span>
            ) : (
              <button type="button" onClick={() => setOpenReview(openReview === "seller" ? null : "seller")} className="text-sm font-medium text-primary hover:underline">Review seller</button>
            )}
          </div>
          {openReview === "seller" && !sellerReviewed && (
            <div className="mt-4 rounded-lg bg-muted/30 p-3">
              <ReviewForm
                onSubmit={(input) => createSellerReview({ orderId, ...input })}
                ratingLabel="How was your experience with this seller?"
                commentLabel="Tell us about your experience (optional)"
                commentPlaceholder="Share what stood out about working with this seller"
                onSuccess={() => { setSellerReviewed(true); setOpenReview(null); }}
              />
            </div>
          )}
        </div>

        {items.map((item) => {
          const reviewed = reviewedProductItemIds.includes(item.id);
          const key = `product-${item.id}`;
          return (
            <div key={item.id} className="py-4 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">Review {item.product_name ?? "this product"}</p>
                  <p className="text-xs text-muted-foreground">Product review · Verified Order</p>
                </div>
                {reviewed ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><RiCheckLine className="size-4" /> Reviewed</span>
                ) : (
                  <button type="button" onClick={() => setOpenReview(openReview === key ? null : key)} className="shrink-0 text-sm font-medium text-primary hover:underline">Review product</button>
                )}
              </div>
              {openReview === key && !reviewed && (
                <div className="mt-4 rounded-lg bg-muted/30 p-3">
                  <ReviewForm
                    onSubmit={(input) => createProductReview({ orderId, orderItemId: item.id, ...input })}
                    ratingLabel="How was this product?"
                    commentLabel="Share your thoughts (optional)"
                    commentPlaceholder="Tell other buyers what you thought about this product"
                    onSuccess={() => { setReviewedProductItemIds((current) => [...current, item.id]); setOpenReview(null); }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
