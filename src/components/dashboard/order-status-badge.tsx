import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/constants";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:      "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800",
  accepted:     "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-800",
  preparing:    "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-950/40 dark:border-violet-800",
  ready:        "text-primary bg-primary/10 border-primary/20 dark:text-primary dark:bg-primary/15 dark:border-primary/30",
  for_delivery: "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-950/40 dark:border-sky-800",
  completed:    "text-muted-foreground bg-muted border-border",
  cancelled:    "text-destructive bg-destructive/10 border-destructive/20",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_STYLES[status])}
    >
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
