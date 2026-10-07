import {
  RiAddLine,
  RiHistoryLine,
  RiRefundLine,
  RiScales3Line,
  RiShoppingBag3Line,
  RiSubtractLine,
  RiBox3Line,
} from "@remixicon/react";
import { formatOrderAge } from "@/lib/order-display";
import {
  formatQuantity,
  formatQuantityDelta,
  INVENTORY_MOVEMENT_LABELS,
  type InventoryMovement,
  type InventoryMovementType,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

const MOVEMENT_ICONS: Record<InventoryMovementType, typeof RiAddLine> = {
  OPENING: RiBox3Line,
  RECEIVED: RiAddLine,
  SOLD: RiShoppingBag3Line,
  RELEASED: RiRefundLine,
  SPOILAGE: RiSubtractLine,
  ADJUSTMENT: RiScales3Line,
};

function describeActor(movement: InventoryMovement, currentUserId: string): string {
  if (movement.movement_type === "SOLD" || movement.movement_type === "RELEASED") {
    return movement.reference_id ? `Order UMA-${movement.reference_id.slice(0, 8).toUpperCase()}` : "Order";
  }
  if (!movement.created_by) return "UMA";
  return movement.created_by === currentUserId ? "You" : "Team member";
}

export function InventoryActivity({
  movements,
  currentUserId,
}: {
  movements: InventoryMovement[];
  currentUserId: string;
}) {
  if (movements.length === 0) {
    return (
      <div
        data-testid="inventory-activity-empty"
        className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center"
      >
        <RiHistoryLine className="mx-auto size-6 text-muted-foreground/70" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted-foreground">Stock changes and sales will appear here.</p>
      </div>
    );
  }

  return (
    <ol
      data-testid="inventory-activity"
      className="divide-y divide-border rounded-xl border border-border bg-card shadow-2xs"
    >
      {movements.map((movement) => {
        const Icon = MOVEMENT_ICONS[movement.movement_type];
        const isIncrease = movement.quantity_delta > 0;
        return (
          <li
            key={movement.id}
            data-testid="inventory-activity-row"
            data-movement-type={movement.movement_type}
            className="flex items-start gap-3 p-3.5 sm:p-4"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                isIncrease
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                <span className="font-medium">{INVENTORY_MOVEMENT_LABELS[movement.movement_type]}</span>
                {movement.product_name && (
                  <span className="text-muted-foreground"> · {movement.product_name}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {describeActor(movement, currentUserId)} · {formatOrderAge(movement.created_at)}
                {movement.reason && <span> · “{movement.reason}”</span>}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  isIncrease ? "text-primary" : "text-foreground"
                )}
              >
                {formatQuantityDelta(movement.quantity_delta)} {movement.unit}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatQuantity(movement.balance_after)} left
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
