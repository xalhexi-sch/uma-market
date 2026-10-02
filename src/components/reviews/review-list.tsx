import { RiCheckLine } from "@remixicon/react";
import type { ReviewEntry } from "@/lib/types";
import { Rating } from "@/components/reui/rating";

export function ReviewList({ reviews, emptyText = "No verified reviews yet." }: { reviews: ReviewEntry[]; emptyText?: string }) {
  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="divide-y divide-border">
      {reviews.map((review) => (
        <article key={review.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <Rating rating={review.rating} size="sm" aria-label={`${review.rating} out of 5 stars`} />
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <RiCheckLine className="size-3.5" aria-hidden="true" /> Verified Order
            </span>
            <time className="text-xs text-muted-foreground" dateTime={review.created_at}>
              {new Date(review.created_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}
            </time>
          </div>
          {review.comment && <p className="mt-2 text-sm leading-relaxed text-foreground/90">{review.comment}</p>}
        </article>
      ))}
    </div>
  );
}
