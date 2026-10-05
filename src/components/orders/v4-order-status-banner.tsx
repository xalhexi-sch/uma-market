import {
  RiTimeLine,
  RiCheckboxCircleLine,
  RiTruckLine,
  RiStore2Line,
  RiCloseCircleLine,
  RiInformationLine,
  RiShoppingBag3Line,
} from "@remixicon/react";
import type { OrderStatus, FulfillmentType } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface V4OrderStatusBannerProps {
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  cancellationReason?: string | null;
  pickupDate?: string | null;
  deliveryAddress?: string | null;
  farmerName?: string;
  className?: string;
}

export function V4OrderStatusBanner({
  status,
  fulfillmentType,
  cancellationReason,
  pickupDate,
  farmerName,
  className,
}: V4OrderStatusBannerProps) {
  const isDelivery = fulfillmentType === "seller_delivery";

  if (status === "cancelled") {
    return (
      <div
        data-testid="order-status-banner"
        className={cn(
          "rounded-xl border border-destructive/20 bg-destructive/5 p-4 sm:p-5 flex items-start gap-3.5",
          className
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive mt-0.5">
          <RiCloseCircleLine className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-destructive">Order Cancelled</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {cancellationReason ? `Reason: ${cancellationReason}` : "This order was cancelled."}
          </p>
          <p className="mt-2 text-xs font-medium text-foreground">
            Next step: Browse the marketplace to find alternative produce from other local producers.
          </p>
        </div>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div
        data-testid="order-status-banner"
        className={cn(
          "rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5 flex items-start gap-3.5",
          className
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
          <RiCheckboxCircleLine className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Order Completed</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This order has been successfully fulfilled and received.
          </p>
          <p className="mt-2 text-xs font-medium text-foreground">
            Next step: Share feedback by reviewing this produce below, or reorder items when inventory is low.
          </p>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div
        data-testid="order-status-banner"
        className={cn(
          "rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 flex items-start gap-3.5",
          className
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 mt-0.5">
          <RiTimeLine className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Awaiting Producer Acceptance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {farmerName || "The producer"} has been notified and will confirm availability shortly.
          </p>
          <p className="mt-2 text-xs font-medium text-foreground">
            Next step: Sit tight while the producer reviews your order. You may message them or cancel if your schedule changes.
          </p>
        </div>
      </div>
    );
  }

  if (status === "accepted") {
    return (
      <div
        data-testid="order-status-banner"
        className={cn(
          "rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5 flex items-start gap-3.5",
          className
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 mt-0.5">
          <RiInformationLine className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Order Confirmed by Producer</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The producer has accepted your order and added it to their harvest schedule.
          </p>
          <p className="mt-2 text-xs font-medium text-foreground">
            Next step: No action required right now. The producer will begin preparing your items.
          </p>
        </div>
      </div>
    );
  }

  if (status === "preparing") {
    return (
      <div
        data-testid="order-status-banner"
        className={cn(
          "rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 sm:p-5 flex items-start gap-3.5",
          className
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 mt-0.5">
          <RiShoppingBag3Line className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Produce Being Prepared</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Fresh produce is being harvested, cleaned, and packed to order.
          </p>
          <p className="mt-2 text-xs font-medium text-foreground">
            Next step: Verify fulfillment instructions and ensure your receiving contact is prepared.
          </p>
        </div>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div
        data-testid="order-status-banner"
        className={cn(
          "rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5 flex items-start gap-3.5",
          className
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
          {isDelivery ? (
            <RiTruckLine className="size-5" aria-hidden="true" />
          ) : (
            <RiStore2Line className="size-5" aria-hidden="true" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-foreground">
            {isDelivery ? "Packed and Ready for Dispatch" : "Ready for Pickup!"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isDelivery
              ? "Your items are packaged and waiting for dispatch to your address."
              : `Your produce is packed and ready for collection${pickupDate ? ` on ${pickupDate}` : ""}.`}
          </p>
          <p className="mt-2 text-xs font-medium text-foreground">
            Next step: {isDelivery ? "Ensure someone is available at the delivery location to receive the goods." : "Collect your order from the producer's pickup location."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "for_delivery") {
    return (
      <div
        data-testid="order-status-banner"
        className={cn(
          "rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 sm:p-5 flex items-start gap-3.5",
          className
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 mt-0.5">
          <RiTruckLine className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Out for Delivery</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your produce is in transit to your specified address.
          </p>
          <p className="mt-2 text-xs font-medium text-foreground">
            Next step: Please have receiving staff inspect the shipment upon arrival and confirm receipt.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
