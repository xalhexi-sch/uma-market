import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiAlertLine,
  RiTimeLine,
  RiTruckLine,
  RiCheckboxCircleLine,
  RiStore2Line,
  RiShoppingBagLine,
  RiShoppingCart2Line,
  RiInboxLine,
  RiPlantLine,
  RiMessage2Line,
  RiArrowRightLine,
  RiShieldUserLine,
  RiTeamLine,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { V4DashboardContextBar } from "@/components/dashboard/v4-dashboard-context-bar";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { ProductStatusBadge } from "@/components/dashboard/product-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireActiveBusiness, type ActiveBusinessContext } from "@/platform";
import {
  getV4BuyerOrders,
  getV4BuyerOrderTabCounts,
  getFarmerOrders,
  type OrderTabCounts,
} from "@/lib/supabase/queries/orders";
import { getFarmerProducts } from "@/lib/supabase/queries/products";
import { getUserConversations, type Conversation } from "@/lib/supabase/queries/messages";
import type { Order, Product } from "@/lib/types";
import { routes } from "@/platform/routes";
import { AppError } from "@/platform/errors";
import { getStockState } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard — UMA Market",
  description: "Operational overview and action center for your business on UMA Market.",
};

export const dynamic = "force-dynamic";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function V4DashboardPage() {
  let context: ActiveBusinessContext;
  try {
    context = await requireActiveBusiness();
  } catch (err: unknown) {
    if (err instanceof AppError && err.code === "ACCOUNT_INACTIVE") {
      redirect("/sign-in?revoked=true");
    }
    if (err instanceof AppError && err.code === "UNAUTHENTICATED") {
      redirect(routes.signIn);
    }
    if (
      err instanceof AppError &&
      (err.message.includes("No active business") || err.message.includes("onboarding"))
    ) {
      redirect(routes.onboarding);
    }
    if (err instanceof AppError && err.code === "UNAUTHORIZED") {
      redirect(routes.signIn);
    }
    redirect(routes.onboarding);
  }

  const { business, role, canBuy, canSell, isOwner, memberships } = context;
  const greeting = getTimeOfDayGreeting();
  const userName = context.user.profile.full_name || context.user.profile.business_name || "Partner";

  // Effective seller Clerk ID: prioritize legacy_clerk_id on the business if present
  const sellerClerkId = business.legacy_clerk_id || context.user.userId;

  // Concurrent operational data fetching
  const [
    buyerTabCountsResult,
    buyerOrdersResult,
    sellerProductsResult,
    sellerOrdersResult,
    conversationsResult,
  ] = await Promise.allSettled([
    canBuy ? getV4BuyerOrderTabCounts(business.id, business.legacy_clerk_id) : Promise.resolve(null),
    canBuy ? getV4BuyerOrders(business.id, { limit: 5 }, business.legacy_clerk_id) : Promise.resolve([]),
    canSell ? getFarmerProducts(sellerClerkId) : Promise.resolve([]),
    canSell ? getFarmerOrders(sellerClerkId, { limit: 5 }) : Promise.resolve([]),
    getUserConversations(context.user.userId, canSell ? "farmer" : "business"),
  ]);

  const buyerTabCounts: OrderTabCounts | null =
    buyerTabCountsResult.status === "fulfilled" ? buyerTabCountsResult.value : null;
  const buyerOrders: Order[] =
    buyerOrdersResult.status === "fulfilled" ? buyerOrdersResult.value : [];
  const sellerProducts: Product[] =
    sellerProductsResult.status === "fulfilled" ? sellerProductsResult.value : [];
  const sellerOrders: Order[] =
    sellerOrdersResult.status === "fulfilled" ? sellerOrdersResult.value : [];
  const conversations: Conversation[] =
    conversationsResult.status === "fulfilled" ? conversationsResult.value : [];

  // Deterministic Operational Computations
  const sellerPendingOrders = sellerOrders.filter((o) => o.status === "pending");

  const activeProducts = sellerProducts.filter((p) => p.status === "active");
  const lowStockProducts = sellerProducts.filter((p) => {
    if (p.status !== "active") return false;
    const state = getStockState(p.quantity_available, p.min_order_quantity);
    return state === "low" || state === "below_moq";
  });
  const outOfStockProducts = sellerProducts.filter((p) => {
    return p.status === "out_of_stock" || getStockState(p.quantity_available, p.min_order_quantity) === "out";
  });
  const inventoryWarningItems = sellerProducts.filter(
    (p) => getStockState(p.quantity_available, p.min_order_quantity) !== "ok"
  );

  const buyerNeedsCount = buyerTabCounts?.needs ?? buyerOrders.filter((o) => o.status === "pending").length;
  const buyerProgressCount = buyerTabCounts?.progress ?? buyerOrders.filter((o) =>
    ["accepted", "preparing", "ready"].includes(o.status)
  ).length;

  // Check if any urgent operational tasks need attention
  const hasAttentionItems =
    (canSell && sellerPendingOrders.length > 0) ||
    (canSell && inventoryWarningItems.length > 0) ||
    (canBuy && buyerNeedsCount > 0) ||
    (canBuy && buyerProgressCount > 0);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketplaceHeader activeRoute="dashboard" />

      <main className="flex-1 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
          {/* Section 1: Greeting & Active Business Context */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {greeting}, {userName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Operational overview and action center for <span className="font-semibold text-foreground">{business.name}</span>.
              </p>
            </div>

            <V4DashboardContextBar
              business={business}
              role={role}
              canBuy={canBuy}
              canSell={canSell}
              memberships={memberships}
            />
          </div>

          {/* Section 2: "Needs your attention" */}
          <section data-testid="needs-attention-section" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Needs your attention
              </h2>
              <span className="text-xs text-muted-foreground">
                Real-time operational alerts
              </span>
            </div>

            {hasAttentionItems ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Seller Incoming Pending Orders Alert */}
                {canSell && sellerPendingOrders.length > 0 && (
                  <div
                    data-testid="attention-seller-pending"
                    className="flex flex-col justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <RiInboxLine className="size-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {sellerPendingOrders.length} New Wholesale Order{sellerPendingOrders.length > 1 ? "s" : ""}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Incoming buyer orders require confirmation before packing and fulfillment can begin.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-amber-500/15 flex justify-end">
                      <Link
                        href={routes.dashboardOrders}
                        className={buttonVariants({ size: "sm", variant: "default" })}
                      >
                        Review Orders
                        <RiArrowRightLine className="ml-1.5 size-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Seller Low Inventory Alert */}
                {canSell && inventoryWarningItems.length > 0 && (
                  <div
                    data-testid="attention-seller-stock"
                    className="flex flex-col justify-between rounded-xl border border-red-500/30 bg-red-500/5 p-4 sm:p-5 shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                        <RiAlertLine className="size-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {inventoryWarningItems.length} Low Stock or Sold-Out Item{inventoryWarningItems.length > 1 ? "s" : ""}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Products have reached or fallen below minimum order quantities and may block new orders.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-red-500/15 flex justify-end">
                      <Link
                        href={routes.dashboard.inventory}
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                      >
                        Manage Inventory
                        <RiArrowRightLine className="ml-1.5 size-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Buyer Orders Awaiting Acceptance */}
                {canBuy && buyerNeedsCount > 0 && (
                  <div
                    data-testid="attention-buyer-pending"
                    className="flex flex-col justify-between rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 sm:p-5 shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        <RiTimeLine className="size-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {buyerNeedsCount} Order{buyerNeedsCount > 1 ? "s" : ""} Awaiting Producer Confirmation
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Orders placed by your business are currently pending acceptance by the producer.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-sky-500/15 flex justify-end">
                      <Link
                        href={`${routes.orders}?view=needs`}
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                      >
                        View Pending Orders
                        <RiArrowRightLine className="ml-1.5 size-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Buyer Orders In Progress */}
                {canBuy && buyerProgressCount > 0 && (
                  <div
                    data-testid="attention-buyer-progress"
                    className="flex flex-col justify-between rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <RiTruckLine className="size-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {buyerProgressCount} Order{buyerProgressCount > 1 ? "s" : ""} In Progress / Ready
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Producers are preparing or have readied your wholesale orders for delivery or pickup.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-primary/15 flex justify-end">
                      <Link
                        href={`${routes.orders}?view=progress`}
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                      >
                        Track Progress
                        <RiArrowRightLine className="ml-1.5 size-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                data-testid="all-clear-card"
                className="flex items-center gap-3.5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground shadow-2xs"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <RiCheckboxCircleLine className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">All operations are clear</h3>
                  <p className="text-xs text-muted-foreground">
                    No urgent pending actions required. Your orders, inventory, and communications are up to date.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Section 3: Quick Actions */}
          <section data-testid="quick-actions-section" className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Quick actions
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {canBuy && (
                <Link
                  href={routes.products}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/30 shadow-2xs"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <RiStore2Line className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      Browse Marketplace
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Discover fresh produce directly from local farms.
                    </p>
                  </div>
                </Link>
              )}

              <Link
                href={canSell && !canBuy ? routes.dashboardOrders : routes.orders}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/30 shadow-2xs"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                  <RiShoppingBagLine className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {canSell && !canBuy ? "Fulfill Orders" : "My Orders"}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Review status, delivery logistics, and receipts.
                  </p>
                </div>
              </Link>

              {canBuy && (
                <Link
                  href={routes.cart}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/30 shadow-2xs"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <RiShoppingCart2Line className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      Shopping Cart
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Manage items ready for business checkout.
                    </p>
                  </div>
                </Link>
              )}

              {canSell && (
                <Link
                  href={routes.dashboard.listings}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/30 shadow-2xs"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <RiPlantLine className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      Produce Listings
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Manage harvests, prices, and available catalog.
                    </p>
                  </div>
                </Link>
              )}

              {canSell && (
                <Link
                  href={routes.dashboard.inventory}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/30 shadow-2xs"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <RiInboxLine className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      Inventory Operations
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Track stock balances, log received harvests, and adjust counts.
                    </p>
                  </div>
                </Link>
              )}

              <Link
                href="/messages"
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/30 shadow-2xs"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                  <RiMessage2Line className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    Direct Messages
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Coordinate delivery schedules and terms with partners.
                  </p>
                </div>
              </Link>
            </div>
          </section>

          {/* Section 4: Orders Snapshot */}
          <section data-testid="orders-snapshot-section" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  {canSell && !canBuy ? "Recent Sales Orders" : "Recent Orders"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Active wholesale transactions for {business.name}.
                </p>
              </div>
              <Link
                href={canSell && !canBuy ? routes.dashboardOrders : routes.orders}
                className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
              >
                View all orders
                <RiArrowRightLine className="ml-1 size-3.5" aria-hidden="true" />
              </Link>
            </div>

            {/* Overview metric chips */}
            {canBuy && buyerTabCounts && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <span className="text-[11px] font-medium text-muted-foreground">Needs response</span>
                  <p className="text-xl font-bold text-foreground mt-0.5">{buyerTabCounts.needs}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <span className="text-[11px] font-medium text-muted-foreground">In progress</span>
                  <p className="text-xl font-bold text-foreground mt-0.5">{buyerTabCounts.progress}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <span className="text-[11px] font-medium text-muted-foreground">Completed</span>
                  <p className="text-xl font-bold text-foreground mt-0.5">{buyerTabCounts.completed}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <span className="text-[11px] font-medium text-muted-foreground">All orders</span>
                  <p className="text-xl font-bold text-foreground mt-0.5">
                    {buyerTabCounts.needs + buyerTabCounts.progress + buyerTabCounts.completed + buyerTabCounts.cancelled}
                  </p>
                </div>
              </div>
            )}

            {/* Order table / cards */}
            {canBuy && buyerOrders.length > 0 ? (
              <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
                {buyerOrders.slice(0, 4).map((order) => {
                  const producerName =
                    order.farmer?.business_name || order.farmer?.full_name || "Producer";
                  const orderRef = `UMA-${order.id.slice(0, 8).toUpperCase()}`;

                  return (
                    <div
                      key={order.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-foreground">
                            {orderRef}
                          </span>
                          <OrderStatusBadge status={order.status} />
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {order.fulfillment_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          From <span className="font-medium text-foreground">{producerName}</span> • Placed {formatDate(order.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(order.total_amount ?? 0)}
                        </span>
                        <Link
                          href={routes.order(order.id)}
                          className={buttonVariants({ size: "sm", variant: "ghost" })}
                        >
                          Details
                          <RiArrowRightLine className="ml-1 size-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : canSell && sellerOrders.length > 0 ? (
              <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
                {sellerOrders.slice(0, 4).map((order) => {
                  const buyerName =
                    order.business?.business_name || order.business?.full_name || "Buyer";
                  const orderRef = `UMA-${order.id.slice(0, 8).toUpperCase()}`;

                  return (
                    <div
                      key={order.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-foreground">
                            {orderRef}
                          </span>
                          <OrderStatusBadge status={order.status} />
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {order.fulfillment_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          To <span className="font-medium text-foreground">{buyerName}</span> • Received {formatDate(order.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(order.total_amount ?? 0)}
                        </span>
                        <Link
                          href={routes.order(order.id)}
                          className={buttonVariants({ size: "sm", variant: "ghost" })}
                        >
                          Details
                          <RiArrowRightLine className="ml-1 size-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
                <RiShoppingBagLine className="mx-auto size-8 text-muted-foreground/60" aria-hidden="true" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No orders yet</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {canBuy
                    ? "Explore the marketplace to place your first wholesale produce order."
                    : "Incoming orders from verified wholesale buyers will appear here."}
                </p>
                {canBuy && (
                  <div className="mt-4">
                    <Link href={routes.products} className={buttonVariants({ size: "sm" })}>
                      Browse Marketplace
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Section 5: Product & Listing Snapshot (SELL-capable) */}
          {canSell && (
            <section data-testid="products-snapshot-section" className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    Produce Listings
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Active wholesale inventory and market visibility.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={routes.dashboard.inventory}
                    className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Inventory
                  </Link>
                  <Link
                    href={routes.dashboard.listings}
                    className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                  >
                    Manage listings
                    <RiArrowRightLine className="ml-1 size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* Produce metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <span className="text-[11px] font-medium text-muted-foreground">Active Listings</span>
                  <p className="text-xl font-bold text-foreground mt-0.5">{activeProducts.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <span className="text-[11px] font-medium text-muted-foreground">Low Stock</span>
                  <p className="text-xl font-bold text-foreground mt-0.5">{lowStockProducts.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <span className="text-[11px] font-medium text-muted-foreground">Out of Stock</span>
                  <p className="text-xl font-bold text-foreground mt-0.5">{outOfStockProducts.length}</p>
                </div>
              </div>

              {/* Product rows */}
              {sellerProducts.length > 0 ? (
                <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
                  {sellerProducts.slice(0, 4).map((product) => (
                    <div
                      key={product.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground">
                            {product.name}
                          </h4>
                          <ProductStatusBadge status={product.status} />
                          {product.category && (
                            <Badge variant="outline" className="text-[10px]">
                              {product.category.name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(product.price_per_unit)} / {product.unit} • MOQ: {product.min_order_quantity} {product.unit}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                        <span className={cn(
                          "font-medium",
                          product.quantity_available === 0
                            ? "text-destructive font-semibold"
                            : product.quantity_available <= product.min_order_quantity
                            ? "text-amber-600 dark:text-amber-400 font-semibold"
                            : "text-foreground"
                        )}>
                          {product.quantity_available} {product.unit} available
                        </span>
                        <Link
                          href={routes.product(product.id)}
                          className={buttonVariants({ size: "sm", variant: "outline" })}
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
                  <RiPlantLine className="mx-auto size-8 text-muted-foreground/60" aria-hidden="true" />
                  <h3 className="mt-2 text-sm font-semibold text-foreground">No products listed</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    List your harvests on the marketplace to start receiving wholesale buyer orders.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Section 6: Inventory Warnings (SELL-capable with low/out-of-stock items) */}
          {canSell && inventoryWarningItems.length > 0 && (
            <section
              id="inventory-warnings"
              data-testid="inventory-warnings-section"
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RiAlertLine className="size-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    Inventory Alerts
                  </h2>
                </div>
                <Link
                  href={routes.dashboard.inventory}
                  className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                >
                  Manage inventory
                  <RiArrowRightLine className="ml-1 size-3.5" aria-hidden="true" />
                </Link>
              </div>

              <div className="divide-y divide-border rounded-xl border border-amber-500/20 bg-card overflow-hidden shadow-2xs">
                {inventoryWarningItems.map((product) => {
                  const isOut = product.quantity_available === 0 || product.status === "out_of_stock";

                  return (
                    <div
                      key={product.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 bg-amber-500/5"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{product.name}</span>
                          {isOut ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Sold Out
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 dark:text-amber-400">
                              Low Stock: {product.quantity_available} {product.unit}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Minimum order quantity is {product.min_order_quantity} {product.unit}. Replenishment recommended.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={routes.dashboard.inventory}
                          className={buttonVariants({ size: "sm", variant: "outline" })}
                        >
                          Adjust Stock
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section 7: Messages Snapshot */}
          <section data-testid="messages-snapshot-section" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Recent Messages
                </h2>
                <p className="text-xs text-muted-foreground">
                  Direct communication channels with your trade partners.
                </p>
              </div>
              <Link
                href="/messages"
                className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
              >
                View all messages
                <RiArrowRightLine className="ml-1 size-3.5" aria-hidden="true" />
              </Link>
            </div>

            {conversations.length > 0 ? (
              <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
                {conversations.slice(0, 3).map((conv) => (
                  <Link
                    key={conv.orderId}
                    href={`/messages/${conv.orderId}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {conv.counterpartyBusiness || conv.counterpartyName}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {conv.orderNumber}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {conv.lastMessage?.body || "No messages yet."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {conv.lastMessage?.createdAt && (
                        <span>{formatDate(conv.lastMessage.createdAt)}</span>
                      )}
                      <RiArrowRightLine className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
                <RiMessage2Line className="mx-auto size-7 text-muted-foreground/60" aria-hidden="true" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No recent messages</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Order-related discussions with counterparties will appear here.
                </p>
              </div>
            )}
          </section>

          {/* Section 8: Role-based Workspace Info (OWNER vs STAFF) */}
          <section data-testid="role-info-section" className="pt-2">
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {isOwner ? (
                    <RiShieldUserLine className="size-5" aria-hidden="true" />
                  ) : (
                    <RiTeamLine className="size-5" aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {isOwner ? "Owner Privileges" : "Staff Access"}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isOwner
                          ? `As the Owner of ${business.name}, you have administrative and operational control over listings, orders, and team members.`
                          : `You are signed in as Staff for ${business.name}. Operational access (catalog, orders, messages) is active. Administrative settings are managed by the business owner.`}
                      </p>
                    </div>
                    <Link
                      href={routes.dashboard.members}
                      data-testid="role-info-members-link"
                      className={buttonVariants({ size: "sm", variant: isOwner ? "default" : "outline" })}
                    >
                      {isOwner ? "Manage Team" : "View Team"}
                      <RiArrowRightLine className="ml-1.5 size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <MarketplaceFooter />
    </div>
  );
}
