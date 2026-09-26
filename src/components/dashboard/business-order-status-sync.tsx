"use client";

import { useOrderStatusSync } from "@/hooks/use-order-status-sync";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderStatusTimeline } from "@/components/dashboard/order-status-timeline";
import { CancelOrderButton } from "@/components/dashboard/cancel-order-button";
import type { OrderStatus, FulfillmentType } from "@/lib/constants";

interface BusinessOrderStatusSectionProps {
  orderId: string;
  orderCreatedAt: string;
  initialStatus: OrderStatus;
  fulfillmentType: FulfillmentType;
  initialCancellationReason: string | null;
}

/**
 * Client component that subscribes to Supabase Realtime UPDATE events for
 * a single `orders` row and re-renders both:
 *  - the header row (with live status badge + cancel button)
 *  - the full order progress timeline (below the header)
 * without a page reload.
 *
 * SSR initial state is preserved as props; Realtime updates layer on top
 * once the WebSocket connection is established.
 */
export function BusinessOrderStatusSection({
  orderId,
  orderCreatedAt,
  initialStatus,
  fulfillmentType,
  initialCancellationReason,
}: BusinessOrderStatusSectionProps) {
  const { status, cancellationReason } = useOrderStatusSync(
    orderId,
    initialStatus,
    initialCancellationReason
  );

  return (
    <>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground font-mono">
            #{orderId.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold text-foreground">Order Details</h1>
          <p className="text-sm text-muted-foreground">
            Placed{" "}
            {new Date(orderCreatedAt).toLocaleDateString("en-PH", {
              dateStyle: "long",
            })}
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <OrderStatusBadge status={status} />
          {status === "pending" && <CancelOrderButton orderId={orderId} />}
        </div>
      </div>

      {/* Order progress timeline */}
      <OrderStatusTimeline
        status={status}
        fulfillmentType={fulfillmentType}
        cancellationReason={cancellationReason}
      />
    </>
  );
}
