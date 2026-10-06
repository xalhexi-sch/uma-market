import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiShoppingBagLine,
  RiAlertLine,
  RiStore2Line,
  RiArrowRightLine,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { V4SellerOrdersContextBar } from "@/components/dashboard/orders/v4-seller-orders-context-bar";
import { V4SellerOrderCard } from "@/components/dashboard/orders/v4-seller-order-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireActiveBusiness, type ActiveBusinessContext } from "@/platform";
import {
  getV4SellerOrders,
  getV4SellerOrderTabCounts,
  type OrderViewTab,
} from "@/lib/supabase/queries/orders";
import { createClient } from "@/lib/supabase/server";
import { routes } from "@/platform/routes";
import { AppError } from "@/platform/errors";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Seller Orders — UMA Market",
  description: "Manage incoming wholesale produce orders, fulfillment, and state transitions for your business.",
};

export const dynamic = "force-dynamic";

type ViewTab = "all" | OrderViewTab;
const VALID_VIEWS: ViewTab[] = ["needs", "progress", "completed", "cancelled", "all"];

const TAB_CONFIG: Array<{ id: ViewTab; label: string }> = [
  { id: "needs", label: "Needs action" },
  { id: "progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All orders" },
];

const EMPTY_STATE_COPY: Record<ViewTab, { title: string; description: string }> = {
  needs: {
    title: "No orders awaiting action",
    description: "New incoming buyer orders that require your acceptance before packing will appear here.",
  },
  progress: {
    title: "No orders in progress",
    description: "Accepted orders being harvested, packed, or dispatched for delivery will appear here.",
  },
  completed: {
    title: "No completed orders",
    description: "Orders that have been picked up or delivered to wholesale buyers will be recorded here.",
  },
  cancelled: {
    title: "No cancelled orders",
    description: "Orders that were declined due to harvest shortfall or logistics constraints will appear here.",
  },
  all: {
    title: "No incoming wholesale orders",
    description: "Your business has not received any incoming orders yet. Ensure your produce listings are active on the marketplace.",
  },
};

interface PageProps {
  searchParams: Promise<{ view?: string; tab?: string }>;
}

export default async function V4SellerOrdersPage({ searchParams }: PageProps) {
  let context: ActiveBusinessContext;
  try {
    context = await requireActiveBusiness();
  } catch (err: unknown) {
    if (err instanceof AppError && err.code === "ACCOUNT_INACTIVE") {
      redirect("/sign-in?revoked=true");
    }
    if (err instanceof AppError && (err.code === "UNAUTHORIZED" || err.code === "UNAUTHENTICATED")) {
      redirect(routes.signIn);
    }
    redirect(routes.onboarding);
  }

  const { business, role, canBuy, canSell, memberships } = context;

  // ── Guard: SELL capability is mandatory for seller incoming order operations ──
  if (!canSell) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <MarketplaceHeader activeRoute="dashboard" />
        <main className="flex-1 pb-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
            <V4SellerOrdersContextBar
              business={business}
              role={role}
              canBuy={canBuy}
              canSell={canSell}
              memberships={memberships}
            />

            <div
              data-testid="selling-capability-required"
              className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center space-y-4 shadow-2xs"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <RiAlertLine className="size-6" aria-hidden="true" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h2 className="text-lg font-bold text-foreground">
                  Selling Capability Required
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This workspace is for producers and suppliers to manage incoming wholesale produce orders.
                  <span className="font-semibold text-foreground"> {business.name}</span> is currently configured as a Buyer Business.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  href={routes.orders}
                  className={buttonVariants({ variant: "default", size: "sm" })}
                >
                  <RiShoppingBagLine className="mr-1.5 size-4" aria-hidden="true" />
                  View My Buyer Orders
                </Link>
                <Link
                  href={routes.products}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <RiStore2Line className="mr-1.5 size-4" aria-hidden="true" />
                  Browse Marketplace
                </Link>
              </div>
            </div>
          </div>
        </main>
        <MarketplaceFooter />
      </div>
    );
  }

  // Identify all seller Clerk IDs associated with this business (legacy_clerk_id + all members)
  const supabase = await createClient();
  const { data: memberRows } = await supabase
    .from("business_members")
    .select("user_id")
    .eq("business_id", business.id);

  const sellerClerkIds = Array.from(
    new Set(
      [
        business.legacy_clerk_id,
        context.user.userId,
        ...(memberRows?.map((m) => m.user_id) ?? []),
      ].filter(Boolean)
    )
  ) as string[];

  // Resolve active tab view (support both view and tab query param)
  const resolvedSearchParams = await searchParams;
  const rawView = (resolvedSearchParams.view || resolvedSearchParams.tab) as ViewTab | undefined;
  const currentView: ViewTab =
    rawView && VALID_VIEWS.includes(rawView) ? rawView : "needs";

  // Fetch status tab counts and orders concurrently
  const [tabCounts, orders] = await Promise.all([
    getV4SellerOrderTabCounts(sellerClerkIds),
    getV4SellerOrders(sellerClerkIds, {
      statusGroup: currentView === "all" ? undefined : currentView,
      limit: 50,
    }),
  ]);

  const totalAllOrders =
    tabCounts.needs + tabCounts.progress + tabCounts.completed + tabCounts.cancelled;

  function getBadgeCount(tabId: ViewTab): number {
    switch (tabId) {
      case "needs":
        return tabCounts.needs;
      case "progress":
        return tabCounts.progress;
      case "completed":
        return tabCounts.completed;
      case "cancelled":
        return tabCounts.cancelled;
      case "all":
        return totalAllOrders;
    }
  }

  const emptyCopy = EMPTY_STATE_COPY[currentView];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketplaceHeader activeRoute="dashboard" />

      <main className="flex-1 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {/* Header & Title */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Wholesale Order Operations
            </h1>
            <p className="text-sm text-muted-foreground">
              Review, accept, and fulfill incoming wholesale orders placed by buyers for <span className="font-semibold text-foreground">{business.name}</span>.
            </p>
          </div>

          {/* Active Context Bar */}
          <V4SellerOrdersContextBar
            business={business}
            role={role}
            canBuy={canBuy}
            canSell={canSell}
            memberships={memberships}
          />

          {/* Status Group Tabs Navigation */}
          <div
            data-testid="seller-orders-tab-filter"
            className="flex items-center gap-2 overflow-x-auto border-b border-border pb-2 text-sm no-scrollbar"
          >
            {TAB_CONFIG.map((tab) => {
              const isActive = currentView === tab.id;
              const count = getBadgeCount(tab.id);
              const href =
                tab.id === "needs"
                  ? routes.dashboardOrders
                  : `${routes.dashboardOrders}?view=${tab.id}`;

              return (
                <Link
                  key={tab.id}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span>{tab.label}</span>
                  <Badge
                    variant={isActive ? "secondary" : "outline"}
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-4 min-w-[1.25rem] justify-center",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground border-transparent"
                        : "text-muted-foreground"
                    )}
                  >
                    {count}
                  </Badge>
                </Link>
              );
            })}
          </div>

          {/* Orders List Container */}
          {orders.length > 0 ? (
            <div data-testid="seller-orders-list" className="space-y-4">
              {orders.map((order) => (
                <V4SellerOrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <div
              data-testid="seller-orders-empty-state"
              className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center space-y-3"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <RiShoppingBagLine className="size-6" aria-hidden="true" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-semibold text-foreground">
                  {emptyCopy.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {emptyCopy.description}
                </p>
              </div>

              {currentView !== "all" && totalAllOrders > 0 && (
                <div className="pt-2">
                  <Link
                    href={`${routes.dashboardOrders}?view=all`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    View All Orders ({totalAllOrders})
                    <RiArrowRightLine className="ml-1.5 size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <MarketplaceFooter />
    </div>
  );
}
