import { Badge } from "@/components/ui/badge";
import type { ProductStatus } from "@/lib/constants";
import { PRODUCT_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ProductStatus, string> = {
  active: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800",
  draft: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800",
  out_of_stock: "text-destructive bg-destructive/5 border-destructive/20 dark:text-red-400 dark:bg-red-950/40 dark:border-red-800",
  archived: "text-muted-foreground bg-muted border-border",
};

interface ProductStatusBadgeProps {
  status: ProductStatus | string;
  className?: string;
}

export function ProductStatusBadge({ status, className }: ProductStatusBadgeProps) {
  const normalizedStatus = (status in STATUS_STYLES ? status : "draft") as ProductStatus;
  const label = PRODUCT_STATUS_LABELS[normalizedStatus] ?? status;

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_STYLES[normalizedStatus], className)}
    >
      {label}
    </Badge>
  );
}
