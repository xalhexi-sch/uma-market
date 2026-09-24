import { RiCheckLine } from "@remixicon/react";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus, FulfillmentType } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface OrderStatusTimelineProps {
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  cancellationReason?: string | null;
}

const STATUS_FLOW: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "for_delivery",
  "completed",
];

function getStatusDescription(
  status: OrderStatus,
  isDelivery: boolean,
  isCurrent: boolean,
  isCompleted: boolean
): string {
  switch (status) {
    case "pending":
      if (isCurrent) return "Waiting for the producer to confirm the order";
      return isCompleted ? "Order submitted" : "Awaiting confirmation";
    case "accepted":
      if (isCurrent) return "Producer confirmed the order and will prepare it";
      return isCompleted ? "Order confirmed" : "Producer confirmation";
    case "preparing":
      if (isCurrent) return "Produce is being harvested and packaged";
      return isCompleted ? "Harvested and packaged" : "Harvesting & packaging";
    case "ready":
      if (isCurrent) {
        return isDelivery
          ? "Packed and ready for delivery"
          : "Ready for pickup at the farm";
      }
      return isCompleted
        ? isDelivery
          ? "Packed for delivery"
          : "Ready for pickup"
        : isDelivery
        ? "Ready for delivery"
        : "Ready for pickup";
    case "for_delivery":
      if (isCurrent) return "On the way to your delivery address";
      return isCompleted ? "Delivered to destination" : "Out for delivery";
    case "completed":
      if (isCurrent) {
        return isDelivery
          ? "Order delivered and completed"
          : "Order picked up and completed";
      }
      return isCompleted ? "Order fulfilled" : "Order fulfillment";
    default:
      return "";
  }
}

export function OrderStatusTimeline({
  status,
  fulfillmentType,
  cancellationReason,
}: OrderStatusTimelineProps) {
  const isDelivery = fulfillmentType === "seller_delivery";
  const isCancelled = status === "cancelled";

  if (isCancelled) {
    return (
      <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3">
        <p className="text-sm font-medium text-destructive">Order Cancelled</p>
        {cancellationReason && (
          <p className="text-sm text-muted-foreground mt-0.5">{cancellationReason}</p>
        )}
      </div>
    );
  }

  // Filter steps: omit 'for_delivery' if pickup
  const steps = STATUS_FLOW.filter((s) => s !== "for_delivery" || isDelivery);
  const activeIndex = steps.indexOf(status);

  return (
    <div className="w-full">
      {/* Desktop / Tablet Horizontal Timeline (>= sm) */}
      <div className="hidden sm:flex items-center gap-0">
        {steps.map((s, i) => {
          const isPast = i <= activeIndex;
          const isActive = i === activeIndex;
          return (
            <div key={s} className="flex flex-1 items-center gap-0">
              <div className="flex flex-col items-center">
                <div
                  className={`h-2.5 w-2.5 rounded-full border-2 transition-colors ${
                    isPast
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  } ${isActive ? "ring-2 ring-primary/30" : ""}`}
                />
                <span
                  className={`mt-1.5 text-[10px] text-center ${
                    isPast ? "text-primary font-medium" : "text-muted-foreground"
                  }`}
                >
                  {ORDER_STATUS_LABELS[s]}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-[2px] flex-1 -mt-3.5 mx-0.5 transition-colors ${
                    i < activeIndex ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Small Mobile Vertical Stepper (< sm) */}
      <div className="sm:hidden rounded-xl border border-border bg-card p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Order Progress
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            Step {Math.max(activeIndex + 1, 1)} of {steps.length}
          </span>
        </div>

        <div className="flex flex-col">
          {steps.map((s, i) => {
            const isCompleted = i < activeIndex;
            const isCurrent = i === activeIndex;
            const isUpcoming = i > activeIndex;
            const isLast = i === steps.length - 1;

            return (
              <div key={s} className="flex gap-3">
                {/* Stepper node and continuous vertical connector */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full transition-all",
                      isCompleted && "bg-primary text-primary-foreground shadow-2xs",
                      isCurrent &&
                        "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-xs",
                      isUpcoming &&
                        "border-2 border-border bg-background text-muted-foreground/40"
                    )}
                  >
                    {isCompleted ? (
                      <RiCheckLine className="size-3.5 stroke-[2.5]" />
                    ) : isCurrent ? (
                      <span className="size-2 rounded-full bg-primary-foreground animate-pulse" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>

                  {!isLast && (
                    <div
                      className={cn(
                        "w-0.5 flex-1 my-1 min-h-[22px] transition-colors",
                        isCompleted ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </div>

                {/* Step content */}
                <div
                  className={cn(
                    "flex flex-col pb-3.5 min-w-0 flex-1",
                    isLast && "pb-0"
                  )}
                >
                  <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                    <span
                      className={cn(
                        "text-sm tracking-tight",
                        isCurrent && "font-semibold text-foreground",
                        isCompleted && "font-medium text-foreground",
                        isUpcoming && "font-normal text-muted-foreground"
                      )}
                    >
                      {ORDER_STATUS_LABELS[s]}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Current Status
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-xs mt-0.5",
                      isCurrent
                        ? "text-muted-foreground font-medium"
                        : isCompleted
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                    )}
                  >
                    {getStatusDescription(s, isDelivery, isCurrent, isCompleted)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
