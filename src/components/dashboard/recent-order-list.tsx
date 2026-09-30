import Link from "next/link";
import { RiShoppingBagLine, RiArrowRightLine } from "@remixicon/react";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { CURRENCY, FULFILLMENT_LABELS } from "@/lib/constants";
import type { Order } from "@/lib/types";
import {
  getBuyerName,
  getSellerName,
  summarizeOrderItems,
  formatOrderAge,
} from "@/lib/order-display";

interface RecentOrderListProps {
  orders: Order[];
  role: "business" | "farmer";
  emptyTitle?: string;
  emptyDescription?: string;
  actionHref?: string;
  actionLabel?: string;
}

export function RecentOrderList({
  orders,
  role,
  emptyTitle = "No orders yet",
  emptyDescription = "Recent wholesale orders will appear here.",
  actionHref,
  actionLabel,
}: RecentOrderListProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <RiShoppingBagLine className="size-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          {emptyDescription}
        </p>
        {actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            <span>{actionLabel}</span>
            <RiArrowRightLine className="size-3.5" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
      {/* Desktop Column Header */}
      <div className="hidden sm:grid sm:grid-cols-[minmax(180px,1.2fr)_minmax(180px,1.5fr)_minmax(110px,0.8fr)_minmax(100px,0.8fr)_auto] items-center gap-4 px-4 py-2.5 text-xs font-medium text-muted-foreground bg-muted/40">
        <div>{role === "business" ? "Farmer" : "Business"}</div>
        <div>Items</div>
        <div>Fulfillment</div>
        <div className="text-right">Total</div>
        <div className="text-right">Status</div>
      </div>

      {/* Order Rows */}
      {orders.map((order) => {
        const counterparty =
          role === "business" ? getSellerName(order) : getBuyerName(order);
        const ref = order.id.slice(0, 8).toUpperCase();
        const age = formatOrderAge(order.created_at);
        const itemsSummary = summarizeOrderItems(order.items);
        const fulfillmentLabel = FULFILLMENT_LABELS[order.fulfillment_type];
        const formattedTotal = `${CURRENCY}${(order.total_amount ?? 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
        })}`;
        const targetHref =
          role === "business"
            ? `/business/orders/${order.id}`
            : `/farmer/orders/${order.id}`;

        return (
          <Link
            key={order.id}
            href={targetHref}
            className="block px-4 py-3 hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* Desktop / Tablet Layout (sm+) */}
            <div className="hidden sm:grid sm:grid-cols-[minmax(180px,1.2fr)_minmax(180px,1.5fr)_minmax(110px,0.8fr)_minmax(100px,0.8fr)_auto] items-center gap-4">
              {/* Counterparty */}
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  {counterparty}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  #{ref} · {age}
                </p>
              </div>

              {/* Items */}
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">
                  {itemsSummary}
                </p>
              </div>

              {/* Fulfillment */}
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  {fulfillmentLabel}
                </p>
              </div>

              {/* Total */}
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {formattedTotal}
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex justify-end">
                <OrderStatusBadge status={order.status} />
              </div>
            </div>

            {/* Mobile Layout (< sm): 2-Row Compact */}
            <div className="sm:hidden flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {counterparty}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    #{ref} · {age} · {fulfillmentLabel}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              <div className="flex items-center justify-between gap-3 text-sm pt-0.5">
                <p className="text-xs text-muted-foreground truncate flex-1">
                  {itemsSummary}
                </p>
                <p className="font-semibold text-foreground tabular-nums shrink-0">
                  {formattedTotal}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
