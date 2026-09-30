import { RiCheckLine, RiTimeLine, RiCircleLine, RiCloseLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus, FulfillmentType } from "@/lib/constants";

/** Full status flow for delivery orders */
const DELIVERY_FLOW: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "for_delivery",
  "completed",
];

/** Pickup orders skip the for_delivery step */
const PICKUP_FLOW: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "completed",
];

interface OrderProgressStepsProps {
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  cancellationReason?: string | null;
}

/**
 * A compact vertical progress list showing done / current / upcoming steps.
 *
 * Server-safe: no hooks, no client state.
 * Does NOT modify order-status-timeline.tsx (buyer side).
 */
export function OrderProgressSteps({
  status,
  fulfillmentType,
  cancellationReason,
}: OrderProgressStepsProps) {
  // Cancelled: show destructive box only
  if (status === "cancelled") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <RiCloseLine className="size-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-destructive">
            Order cancelled
          </p>
          {cancellationReason && (
            <p className="mt-1 text-sm text-muted-foreground">
              {cancellationReason}
            </p>
          )}
        </div>
      </div>
    );
  }

  const flow =
    fulfillmentType === "seller_delivery" ? DELIVERY_FLOW : PICKUP_FLOW;
  const currentIndex = flow.indexOf(status);
  const isCompleted = status === "completed";

  return (
    <ol className="space-y-0" aria-label="Order progress">
      {flow.map((step, index) => {
        const isDone = index < currentIndex || (isCompleted && index === currentIndex);
        const isCurrent = index === currentIndex && !isCompleted;

        return (
          <li
            key={step}
            className="relative flex items-start gap-3"
            aria-current={isCurrent ? "step" : undefined}
          >
            {/* Connector line */}
            {index < flow.length - 1 && (
              <div
                className={cn(
                  "absolute left-[9px] top-[22px] w-0.5 h-[calc(100%)]",
                  index < currentIndex ? "bg-primary" : "bg-border"
                )}
              />
            )}

            {/* Icon */}
            <div className="relative z-10 mt-0.5 shrink-0">
              {isDone ? (
                <RiCheckLine className="size-[18px] text-primary" />
              ) : isCurrent ? (
                <RiTimeLine className="size-[18px] text-primary" />
              ) : (
                <RiCircleLine className="size-[18px] text-muted-foreground/40" />
              )}
            </div>

            {/* Label */}
            <p
              className={cn(
                "pb-4 text-sm font-medium",
                isDone || isCurrent
                  ? "text-foreground"
                  : "text-muted-foreground/60",
                isCurrent && "text-primary"
              )}
            >
              {step === "completed" && fulfillmentType === "pickup"
                ? "Picked Up"
                : step === "completed" && fulfillmentType === "seller_delivery"
                  ? "Delivered"
                  : ORDER_STATUS_LABELS[step]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
