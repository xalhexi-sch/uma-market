"use client";

import { useOrderStatusSync } from "@/hooks/use-order-status-sync";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderStatusActions } from "@/components/dashboard/order-status-actions";
import type { OrderStatus } from "@/lib/constants";

interface FarmerOrderStatusSectionProps {
  orderId: string;
  bizName: string;
  orderCreatedAt: string;
  initialStatus: OrderStatus;
  initialCancellationReason: string | null;
}

/**
 * Client component that subscribes to Supabase Realtime order UPDATE events
 * and re-renders the header row (with status badge) and the status action buttons
 * live — without a page reload.
 *
 * SSR initial state is preserved as props; Realtime updates layer on top
 * once the WebSocket connection is established.
 */
export function FarmerOrderStatusSection({
  orderId,
  bizName,
  orderCreatedAt,
  initialStatus,
  initialCancellationReason,
}: FarmerOrderStatusSectionProps) {
  const { status } = useOrderStatusSync(
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
          <h1 className="mt-0.5 text-xl font-semibold text-foreground">
            Order from {bizName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Placed{" "}
            {new Date(orderCreatedAt).toLocaleDateString("en-PH", {
              dateStyle: "long",
            })}
          </p>
        </div>
        <OrderStatusBadge status={status} />
      </div>

      {/* Farmer action buttons — driven by live status */}
      <OrderStatusActions orderId={orderId} currentStatus={status} />
    </>
  );
}
