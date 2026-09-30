import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiShoppingBagLine,
  RiTruckLine,
  RiStore2Line,
  RiArrowRightSLine,
} from "@remixicon/react";
import { getFarmerOrders } from "@/lib/supabase/queries/orders";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { CURRENCY, FULFILLMENT_LABELS } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import {
  getBuyerName,
  summarizeOrderItems,
  formatOrderAge,
} from "@/lib/order-display";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Incoming Orders" };
export const dynamic = "force-dynamic";

type ViewTab = "needs" | "progress" | "completed" | "cancelled";
const VALID_VIEWS: ViewTab[] = ["needs", "progress", "completed", "cancelled"];

const TAB_CONFIG: Array<{ id: ViewTab; label: string }> = [
  { id: "needs", label: "Needs response" },
  { id: "progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const EMPTY_STATE_COPY: Record<ViewTab, { title: string; description: string }> = {
  needs: {
    title: "No orders awaiting response",
    description:
      "New wholesale orders from businesses will appear here for you to accept or decline.",
  },
  progress: {
    title: "No orders in progress",
    description:
      "Orders that you've accepted and are preparing or out for delivery will show here.",
  },
  completed: {
    title: "No completed orders",
    description: "Orders that have been picked up or delivered will appear here.",
  },
  cancelled: {
    title: "No cancelled orders",
    description: "Declined or cancelled orders will be archived here.",
  },
};

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function FarmerOrdersPage({ searchParams }: PageProps) {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "farmer" || !userId) {
    redirect(role === "business" ? "/business/orders" : "/onboarding");
  }

  const { view } = await searchParams;
  const orders = await getFarmerOrders(userId);

  // Group orders by tab view
  const tabGroups: Record<ViewTab, typeof orders> = {
    needs: orders.filter((o) => o.status === "pending"),
    progress: orders.filter((o) =>
      ["accepted", "preparing", "ready", "for_delivery"].includes(o.status)
    ),
    completed: orders.filter((o) => o.status === "completed"),
    cancelled: orders.filter((o) => o.status === "cancelled"),
  };

  // Default view = first non-empty tab in order; invalid ?view falls back to default
  const defaultView =
    VALID_VIEWS.find((key) => tabGroups[key].length > 0) ?? "needs";
  const activeView: ViewTab =
    view && (VALID_VIEWS as string[]).includes(view)
      ? (view as ViewTab)
      : defaultView;

  // Sort orders: needs/progress oldest-first (longest waiting); completed/cancelled newest-first
  const currentOrders = [...tabGroups[activeView]].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (activeView === "needs" || activeView === "progress") {
      return timeA - timeB;
    }
    return timeB - timeA;
  });

  const pendingCount = tabGroups.needs.length;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Incoming Orders
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pendingCount > 0
            ? `${pendingCount} order${pendingCount !== 1 ? "s" : ""} awaiting your response`
            : "No orders awaiting response"}
        </p>
      </div>

      {orders.length === 0 ? (
        /* Global Empty State (no orders at all) */
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center rounded-xl border border-dashed border-border">
          <RiShoppingBagLine className="size-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-foreground">No orders yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Orders from businesses will appear here once you have active products.
            </p>
          </div>
          <Link
            href="/farmer/products"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Manage Products
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Link-based Tabs */}
          <div className="flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-none pb-0.5 -mx-4 px-4 sm:mx-0 sm:px-0">
            {TAB_CONFIG.map((tab) => {
              const isActive = activeView === tab.id;
              const count = tabGroups[tab.id].length;
              const isAmber = tab.id === "needs" && count > 0;

              return (
                <Link
                  key={tab.id}
                  href={`/farmer/orders?view=${tab.id}`}
                  className={cn(
                    "inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap -mb-px min-h-[44px]",
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <span>{tab.label}</span>
                  {isAmber ? (
                    <span className="inline-flex items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-semibold">
                      {count}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium",
                        isActive
                          ? "bg-muted text-foreground"
                          : "bg-muted/60 text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Orders List or Per-tab Empty State */}
          {currentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center rounded-xl border border-dashed border-border p-6">
              <p className="font-medium text-foreground">
                {EMPTY_STATE_COPY[activeView].title}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {EMPTY_STATE_COPY[activeView].description}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card shadow-xs">
              {/* Header on sm+ */}
              <div className="hidden sm:grid sm:grid-cols-[minmax(180px,1.2fr)_minmax(180px,1.5fr)_minmax(110px,0.8fr)_minmax(100px,0.8fr)_auto] items-center gap-4 px-4 py-2.5 text-xs font-medium text-muted-foreground bg-muted/40">
                <div>Business</div>
                <div>Items</div>
                <div>Fulfillment</div>
                <div className="text-right">Total</div>
                <div className="text-right">Status</div>
              </div>

              {/* Order Rows: ONE <Link> per row */}
              {currentOrders.map((order) => {
                const buyerName = getBuyerName(order);
                const ref = order.id.slice(0, 8).toUpperCase();
                const age = formatOrderAge(order.created_at);
                const itemsSummary = summarizeOrderItems(order.items);
                const fulfillmentLabel =
                  FULFILLMENT_LABELS[order.fulfillment_type];
                const formattedTotal = `${CURRENCY}${(order.total_amount ?? 0).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}`;
                const isNeedsAction = activeView === "needs" && order.status === "pending";

                return (
                  <Link
                    key={order.id}
                    href={`/farmer/orders/${order.id}`}
                    className={cn(
                      "block px-4 py-3.5 hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/40",
                      isNeedsAction && "bg-amber-500/[0.03] border-l-2 border-l-amber-500"
                    )}
                  >
                    {/* Desktop / Tablet layout (sm+) */}
                    <div className="hidden sm:grid sm:grid-cols-[minmax(180px,1.2fr)_minmax(180px,1.5fr)_minmax(110px,0.8fr)_minmax(100px,0.8fr)_auto] items-center gap-4">
                      {/* Business */}
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {buyerName}
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

                      {/* Status badge */}
                      <div className="flex justify-end">
                        <OrderStatusBadge status={order.status} />
                      </div>
                    </div>

                    {/* Mobile layout (< sm): Recomposed Operational Card */}
                    <div className="sm:hidden flex flex-col gap-2 py-0.5">
                      {/* Top: Buyer Name, Ref, Status */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground text-sm truncate">
                              {buyerName}
                            </span>
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted text-muted-foreground">
                              #{ref}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <span>{age}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              {order.fulfillment_type === "seller_delivery" ? (
                                <RiTruckLine className="size-3.5 text-primary shrink-0" />
                              ) : (
                                <RiStore2Line className="size-3.5 text-primary shrink-0" />
                              )}
                              <span>{fulfillmentLabel}</span>
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 pt-0.5">
                          <OrderStatusBadge status={order.status} />
                        </div>
                      </div>

                      {/* Middle: Items summary */}
                      <div className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                        <p className="truncate font-medium text-foreground/80">{itemsSummary}</p>
                      </div>

                      {/* Bottom: Total + Action Affordance */}
                      <div className="flex items-center justify-between pt-0.5 text-xs">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="text-sm font-bold text-foreground tabular-nums">
                            {formattedTotal}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 text-xs font-medium text-primary">
                          <span>View Order</span>
                          <RiArrowRightSLine className="size-4 shrink-0" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
