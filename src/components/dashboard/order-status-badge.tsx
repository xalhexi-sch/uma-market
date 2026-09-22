import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/constants";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:      "text-amber-700 bg-amber-50 border-amber-200",
  accepted:     "text-blue-700 bg-blue-50 border-blue-200",
  preparing:    "text-violet-700 bg-violet-50 border-violet-200",
  ready:        "text-emerald-700 bg-emerald-50 border-emerald-200",
  for_delivery: "text-sky-700 bg-sky-50 border-sky-200",
  completed:    "text-muted-foreground bg-muted border-border",
  cancelled:    "text-destructive bg-destructive/5 border-destructive/20",
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
