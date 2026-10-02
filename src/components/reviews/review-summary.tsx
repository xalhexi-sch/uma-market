import type { ReviewSummary as ReviewSummaryType } from "@/lib/types";
import { Rating } from "@/components/reui/rating";

export function ReviewSummary({ summary }: { summary: ReviewSummaryType }) {
  if (summary.reviewCount === 0) {
    return <span className="text-xs text-muted-foreground">No reviews yet</span>;
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm" aria-label={`${summary.averageRating.toFixed(1)} out of 5 from ${summary.reviewCount} reviews`}>
      <Rating rating={summary.averageRating} size="sm" showValue />
      <span className="text-muted-foreground">({summary.reviewCount})</span>
    </span>
  );
}
