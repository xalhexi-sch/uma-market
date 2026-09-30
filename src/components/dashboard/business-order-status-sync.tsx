"use client";

import { useOrderStatusSync } from "@/hooks/use-order-status-sync";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderStatusTimeline } from "@/components/dashboard/order-status-timeline";
import { CancelOrderButton } from "@/components/dashboard/cancel-order-button";
import type { OrderStatus, FulfillmentType } from "@/lib/constants";

interface BusinessOrderStatusSectionProps {
  orderId: string;
  farmerName: string;
  orderCreatedAt: string;
  placedDate?: string;
  initialStatus: OrderStatus;
  fulfillmentType: FulfillmentType;
  initialCancellationReason: string | null;
  mainContent: React.ReactNode;
  asideContent: React.ReactNode;
}

/**
 * Client component that subscribes to Supabase Realtime UPDATE events for
 * a single `orders` row and re-renders both:
 *  - the header row (with live status badge + cancel button)
 *  - the full order progress timeline
 *  - the two-column workspace layout
 * without a page reload.
 *
 * SSR initial state is preserved as props; Realtime updates layer on top
 * once the WebSocket connection is established.
 */
export function BusinessOrderStatusSection({
  orderId,
  farmerName,
  orderCreatedAt,
  placedDate,
  initialStatus,
  fulfillmentType,
  initialCancellationReason,
  mainContent,
  asideContent,
}: BusinessOrderStatusSectionProps) {
  const { status, cancellationReason } = useOrderStatusSync(
    orderId,
    initialStatus,
    initialCancellationReason
  );

  const displayDate =
    placedDate ??
    new Date(orderCreatedAt).toLocaleDateString("en-PH", {
      dateStyle: "long",
    });

  return (
    <>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground font-mono">
            #{orderId.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold text-foreground">
            Order from {farmerName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Placed {displayDate}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <OrderStatusBadge status={status} />
          {status === "pending" && <CancelOrderButton orderId={orderId} />}
        </div>
      </div>

      {/* Two-column grid: main content first (mobile sees items before actions) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left / main */}
        <div className="flex flex-col gap-6">
          {mainContent}
        </div>

        {/* Right / aside */}
        <div className="flex flex-col gap-6">
          {/* Order progress timeline — driven by live status */}
          <OrderStatusTimeline
            status={status}
            fulfillmentType={fulfillmentType}
            cancellationReason={cancellationReason}
          />

          {asideContent}
        </div>
      </div>
    </>
  );
}
