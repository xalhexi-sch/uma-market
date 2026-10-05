import { Badge } from "@/components/ui/badge";
import { STOCK_STATE_LABELS, type StockState } from "@/lib/inventory";
import { cn } from "@/lib/utils";

const STATE_STYLES: Record<StockState, string> = {
  out: "text-destructive bg-destructive/5 border-destructive/25 dark:text-red-400 dark:bg-red-950/40 dark:border-red-800",
  below_moq: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/40 dark:border-orange-800",
  low: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800",
  ok: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800",
};

export function StockStateBadge({ state, className }: { state: StockState; className?: string }) {
  return (
    <Badge
      variant="outline"
      data-stock-state={state}
      className={cn("font-medium", STATE_STYLES[state], className)}
    >
      {STOCK_STATE_LABELS[state]}
    </Badge>
  );
}
