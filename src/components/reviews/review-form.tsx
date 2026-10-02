"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Rating } from "@/components/reui/rating";

interface ReviewFormProps {
  onSubmit: (input: { rating: number; comment?: string }) => Promise<{ success: boolean; error?: string }>;
  onSuccess?: () => void;
  submitLabel?: string;
  ratingLabel: string;
  commentLabel: string;
  commentPlaceholder: string;
}

export function ReviewForm({
  onSubmit,
  onSuccess,
  submitLabel = "Submit review",
  ratingLabel,
  commentLabel,
  commentPlaceholder,
}: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (rating < 1) {
      toast.error("Choose a rating from 1 to 5 stars.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await onSubmit({ rating, comment: comment.trim() || undefined });
      if (!result.success) {
        toast.error(result.error ?? "Review could not be submitted.");
        return;
      }
      toast.success("Review submitted. Thank you for helping build trust on UMA.");
      onSuccess?.();
    } catch {
      toast.error("Review could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-foreground">{ratingLabel}</p>
        <Rating
          className="mt-2"
          rating={rating}
          editable={!submitting}
          onRatingChange={setRating}
          aria-label="Rating from 1 to 5 stars"
        />
      </div>
      <label htmlFor="review-comment" className="text-sm font-medium text-foreground">
        {commentLabel}
      </label>
      <Textarea
        id="review-comment"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={1000}
        rows={3}
        placeholder={commentPlaceholder}
        disabled={submitting}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{comment.length}/1000</span>
        <Button
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Submitting…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
