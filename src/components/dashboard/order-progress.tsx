import { RiCheckLine, RiTimeLine, RiCircleLine, RiCloseLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, getOrderFlow } from "@/lib/constants";
import type { OrderStatus, FulfillmentType } from "@/lib/constants";

/**
 * Visual variants of the shared order-progress display:
 * - "timeline": detailed timeline used by the Business order section
 *   (horizontal dot timeline on sm+, descriptive stepper on small mobile).
 * - "steps": compact vertical check-list used by the Farmer order section.
 * - "compact": page-top horizontal circle stepper (Business, Farmer and
 *   Admin order detail pages).
 */
export type OrderProgressVariant = "timeline" | "steps" | "compact";

interface OrderProgressProps {
  variant: OrderProgressVariant;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  cancellationReason?: string | null;
  className?: string;
}

/** Shared destructive notice shown instead of progress when cancelled. */
function CancelledNotice({ cancellationReason }: { cancellationReason?: string | null }) {
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

// ── "steps": compact vertical check-list (Farmer section) ──────────────

function ProgressSteps({
  status,
  fulfillmentType,
}: {
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
}) {
  const flow = getOrderFlow(fulfillmentType);
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

// ── "timeline": detailed timeline (Business section) ───────────────────

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

function ProgressTimeline({
  status,
  fulfillmentType,
}: {
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
}) {
  const isDelivery = fulfillmentType === "seller_delivery";
  const steps = getOrderFlow(fulfillmentType);
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

// ── "compact": page-top horizontal circle stepper ──────────────────────

function ProgressCompact({
  status,
  fulfillmentType,
  className,
}: {
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  className?: string;
}) {
  const steps = getOrderFlow(fulfillmentType);
  const currentIndex = steps.indexOf(status);

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
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
                    "text-[10px] font-medium text-center leading-tight line-clamp-2 max-w-[56px] sm:max-w-none",
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
                    "mx-0.5 sm:mx-1 h-0.5 flex-1 rounded-full",
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

/**
 * Shared order-progress display driven by the canonical order-state flow
 * (`getOrderFlow`). Server-safe: no hooks, no client state.
 *
 * Current order pages render this server-side from the canonical order state.
 */
export function OrderProgress({
  variant,
  status,
  fulfillmentType,
  cancellationReason,
  className,
}: OrderProgressProps) {
  if (status === "cancelled") {
    return <CancelledNotice cancellationReason={cancellationReason} />;
  }

  switch (variant) {
    case "timeline":
      return <ProgressTimeline status={status} fulfillmentType={fulfillmentType} />;
    case "steps":
      return <ProgressSteps status={status} fulfillmentType={fulfillmentType} />;
    case "compact":
      return <ProgressCompact status={status} fulfillmentType={fulfillmentType} className={className} />;
  }
}
