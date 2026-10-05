import Link from "next/link";
import {
  RiTruckLine,
  RiStore2Line,
  RiArrowRightSLine,
  RiPlantLine,
} from "@remixicon/react";
import type { Order } from "@/lib/types";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { CURRENCY, FULFILLMENT_LABELS } from "@/lib/constants";
import { getSellerName, summarizeOrderItems, formatOrderAge } from "@/lib/order-display";
import { routes } from "@/platform/routes";
import { cn } from "@/lib/utils";

interface V4OrderRowProps {
  order: Order;
  isNeedsAction?: boolean;
}

const NEXT_ACTION_HINTS: Record<string, string> = {
  pending: "Awaiting producer response",
  accepted: "Confirmed · in schedule",
  preparing: "Harvesting & packaging",
  ready: "Ready for pickup / dispatch",
  for_delivery: "In transit to address",
  completed: "Delivered & fulfilled",
  cancelled: "Order closed",
};

export function V4OrderRow({ order, isNeedsAction }: V4OrderRowProps) {
  const producerName = getSellerName(order);
  const ref = order.id.slice(0, 8).toUpperCase();
  const age = formatOrderAge(order.created_at);
  const itemsSummary = summarizeOrderItems(order.items);
  const fulfillmentLabel = FULFILLMENT_LABELS[order.fulfillment_type];
  const isDelivery = order.fulfillment_type === "seller_delivery";
  const formattedTotal = `${CURRENCY}${(order.total_amount ?? 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  })}`;
  const nextActionHint = NEXT_ACTION_HINTS[order.status] ?? "View details";

  return (
    <Link
      href={routes.order(order.id)}
      data-testid={`order-row-${order.id}`}
      className={cn(
        "group block px-4 py-4 hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/40",
        isNeedsAction && "bg-amber-500/[0.03] border-l-2 border-l-amber-500"
      )}
    >
      {/* Desktop / Tablet Grid (sm+) */}
      <div className="hidden sm:grid sm:grid-cols-[minmax(180px,1.2fr)_minmax(180px,1.5fr)_minmax(120px,0.9fr)_minmax(100px,0.8fr)_auto] items-center gap-4">
        {/* Producer & Reference */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {producerName}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            #{ref} · {age}
          </p>
        </div>

        {/* Produce summary & next action hint */}
        <div className="min-w-0">
          <p className="text-sm text-foreground truncate font-medium">
            {itemsSummary}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-primary/60" />
            <span>{nextActionHint}</span>
          </p>
        </div>

        {/* Fulfillment Method */}
        <div className="min-w-0 flex items-center gap-1.5 text-sm text-muted-foreground">
          {isDelivery ? (
            <RiTruckLine className="size-4 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <RiStore2Line className="size-4 shrink-0 text-primary" aria-hidden="true" />
          )}
          <span className="truncate">{fulfillmentLabel}</span>
        </div>

        {/* Total Amount */}
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {formattedTotal}
          </p>
        </div>

        {/* Status Badge + Arrow */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          <OrderStatusBadge status={order.status} />
          <RiArrowRightSLine className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      {/* Mobile Card Layout (<sm) */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        {/* Top: Producer & Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <RiPlantLine className="size-3.5 text-primary shrink-0" aria-hidden="true" />
              <p className="font-semibold text-foreground truncate text-sm">
                {producerName}
              </p>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              #{ref} · {age}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        {/* Items summary */}
        <p className="text-xs text-muted-foreground line-clamp-1">
          {itemsSummary}
        </p>

        {/* Bottom row: Fulfillment, Total & Hint */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            {isDelivery ? (
              <RiTruckLine className="size-3.5 text-primary" />
            ) : (
              <RiStore2Line className="size-3.5 text-primary" />
            )}
            <span>{fulfillmentLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground tabular-nums text-sm">
              {formattedTotal}
            </span>
            <RiArrowRightSLine className="size-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </Link>
  );
}
