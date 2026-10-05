import { RiShieldLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import type { ModerationStatus } from "@/lib/listings";
import { cn } from "@/lib/utils";

const LABELS: Record<Exclude<ModerationStatus, "approved">, string> = {
  flagged: "Under UMA review",
  suspended: "Suspended by UMA",
};

/** UMA (admin) moderation state. Producers can see it but never change it. */
export function ModerationBadge({ status, className }: { status: ModerationStatus; className?: string }) {
  if (status === "approved") return null;

  return (
    <Badge
      variant="outline"
      data-testid="moderation-badge"
      className={cn(
        "gap-1 font-medium text-destructive bg-destructive/5 border-destructive/25 dark:text-red-400 dark:bg-red-950/40 dark:border-red-800",
        className
      )}
    >
      <RiShieldLine className="size-3" aria-hidden="true" />
      {LABELS[status]}
    </Badge>
  );
}
