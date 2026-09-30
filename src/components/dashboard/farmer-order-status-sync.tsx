"use client";

import { useOrderStatusSync } from "@/hooks/use-order-status-sync";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderStatusActions } from "@/components/dashboard/order-status-actions";
import { OrderProgressSteps } from "@/components/dashboard/order-progress-steps";
import type { OrderStatus, FulfillmentType } from "@/lib/constants";

interface FarmerOrderStatusSectionProps {
  orderId: string;
  bizName: string;
  orderCreatedAt: string;
  placedDate?: string;
  initialStatus: OrderStatus;
  initialCancellationReason: string | null;
  fulfillmentType: FulfillmentType;
  mainContent: React.ReactNode;
  asideContent: React.ReactNode;
}

/**
 * Client component that subscribes to Supabase Realtime order UPDATE events
 * and re-renders the header row (with status badge) and the status action buttons
 * live — without a page reload.
 *
 * SSR initial state is preserved as props; Realtime updates layer on top
 * once the WebSocket connection is established.
 *
 * Renders a two-column grid layout:
 * - Left/main (DOM first so mobile shows it before actions): server-rendered items + fulfillment
 * - Right/aside: actions → progress → business contact → chat
 */
export function FarmerOrderStatusSection({
  orderId,
  bizName,
  orderCreatedAt,
  placedDate,
  initialStatus,
  initialCancellationReason,
  fulfillmentType,
  mainContent,
  asideContent,
}: FarmerOrderStatusSectionProps) {
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
            Order from {bizName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Placed {displayDate}
          </p>
        </div>
        <OrderStatusBadge status={status} />
      </div>

      {/* Two-column grid: main content first (mobile sees items before actions) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left / main */}
        <div className="flex flex-col gap-6">
          {mainContent}
        </div>

        {/* Right / aside */}
        <div className="flex flex-col gap-6">
          {/* Farmer action buttons — driven by live status */}
          <OrderStatusActions
            orderId={orderId}
            currentStatus={status}
            fulfillmentType={fulfillmentType}
          />

          {/* Progress steps */}
          {status === "cancelled" ? (
            <OrderProgressSteps
              status={status}
              fulfillmentType={fulfillmentType}
              cancellationReason={cancellationReason}
            />
          ) : (
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium text-foreground mb-3">Progress</p>
              <OrderProgressSteps
                status={status}
                fulfillmentType={fulfillmentType}
                cancellationReason={cancellationReason}
              />
            </div>
          )}

          {asideContent}
        </div>
      </div>
    </>
  );
}
