import { RiCheckLine, RiCircleLine, RiCloseLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";

interface OrderTimelineProps {
  status: OrderStatus;
  fulfillmentType: "pickup" | "seller_delivery";
  cancellationReason?: string | null;
}

const PICKUP_STEPS: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "completed",
];

const DELIVERY_STEPS: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "for_delivery",
  "completed",
];

export function OrderTimeline({ status, fulfillmentType, cancellationReason }: OrderTimelineProps) {
  if (status === "cancelled") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <RiCloseLine className="size-5" />
          <span className="font-medium">Order Cancelled</span>
        </div>
        {cancellationReason && (
          <p className="mt-1 text-sm text-muted-foreground">{cancellationReason}</p>
        )}
      </div>
    );
  }

  const steps = fulfillmentType === "seller_delivery" ? DELIVERY_STEPS : PICKUP_STEPS;
  const currentIndex = steps.indexOf(status);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary",
                    !isCompleted && !isCurrent && "border-border text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <RiCheckLine className="size-3.5" />
                  ) : (
                    <RiCircleLine className="size-3.5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium text-center leading-tight",
                    isCurrent && "text-foreground",
                    !isCurrent && "text-muted-foreground"
                  )}
                >
                  {ORDER_STATUS_LABELS[step]}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-0.5 flex-1 rounded-full",
                    index < currentIndex ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
