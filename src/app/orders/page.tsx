import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiShoppingBagLine,
  RiBuildingLine,
  RiStore2Line,
  RiArrowRightLine,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { V4OrdersContextBar } from "@/components/orders/v4-orders-context-bar";
import { V4OrderRow } from "@/components/orders/v4-order-row";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireActiveBusiness } from "@/platform";
import type { ActiveBusinessContext } from "@/platform";
import {
  getV4BuyerOrders,
  getV4BuyerOrderTabCounts,
  type OrderViewTab,
  type OrderTabCounts,
} from "@/lib/supabase/queries/orders";
import type { Order } from "@/lib/types";
import { routes } from "@/platform/routes";
import { AppError } from "@/platform/errors";
import { redirectIfAccountInactive } from "@/platform/account-gate";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Orders — UMA Market",
  description: "View and manage wholesale agricultural produce orders placed by your business.",
};

export const dynamic = "force-dynamic";

type ViewTab = OrderViewTab;
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
      "Orders you have placed that are waiting for the producer to accept will appear here.",
  },
  progress: {
    title: "No orders in progress",
    description:
      "Orders that have been accepted and are being harvested, prepared, or delivered will show here.",
  },
  completed: {
    title: "No completed orders",
    description: "Orders that have been picked up or delivered will appear here.",
  },
  cancelled: {
    title: "No cancelled orders",
    description: "Cancelled or declined orders will be archived here.",
  },
};

interface OrdersPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  let context: ActiveBusinessContext;

  try {
    context = await requireActiveBusiness();
  } catch (error: unknown) {
    if (error instanceof AppError) {
      if (error.code === "UNAUTHENTICATED") {
        redirect(`/sign-in?redirect_url=${encodeURIComponent(routes.orders)}`);
      }
      if (error.code === "ACCOUNT_INACTIVE") {
        // Revoked/suspended accounts are denied by the layout gate; this re-check
        // keeps them off /onboarding if it is ever bypassed. Only a missing
        // profile falls through to finish setup.
        await redirectIfAccountInactive();
        redirect(routes.onboarding);
      }
      if (error.code === "UNAUTHORIZED" && error.message.includes("No active business")) {
        return (
          <div className="flex min-h-screen flex-col bg-background">
            <MarketplaceHeader />
            <main className="flex-1 mx-auto flex w-full max-w-5xl items-center justify-center px-4 py-12 sm:px-6">
              <Empty data-testid="no-business-state" className="max-w-md">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <RiBuildingLine className="size-6 text-muted-foreground" aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No Active Business Found</EmptyTitle>
                  <EmptyDescription>
                    Your account is not currently associated with an active business. Join an existing
                    organization or complete onboarding to place and track wholesale orders.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Link
                    href={routes.onboarding}
                    className={buttonVariants({ variant: "default" })}
                  >
                    Complete Onboarding
                  </Link>
                </EmptyContent>
              </Empty>
            </main>
            <MarketplaceFooter />
          </div>
        );
      }
    }
    redirect(`/sign-in?redirect_url=${encodeURIComponent(routes.orders)}`);
  }

  const { view } = await searchParams;
  const requestedView =
    view && (VALID_VIEWS as string[]).includes(view)
      ? (view as ViewTab)
      : undefined;

  let tabCounts: OrderTabCounts;
  let currentOrders: Order[];

  const businessId = context.business.id;
  const legacyClerkId = context.business.legacy_clerk_id;

  if (requestedView) {
    [tabCounts, currentOrders] = await Promise.all([
      getV4BuyerOrderTabCounts(businessId, legacyClerkId),
      getV4BuyerOrders(businessId, { statusGroup: requestedView }, legacyClerkId),
    ]);
  } else {
    tabCounts = await getV4BuyerOrderTabCounts(businessId, legacyClerkId);
    const defaultView =
      VALID_VIEWS.find((key) => tabCounts[key] > 0) ?? "needs";
    currentOrders =
      tabCounts.total > 0
        ? await getV4BuyerOrders(businessId, { statusGroup: defaultView }, legacyClerkId)
        : [];
  }

  const defaultView =
    VALID_VIEWS.find((key) => tabCounts[key] > 0) ?? "needs";
  const activeView: ViewTab = requestedView ?? defaultView;
  const pendingCount = tabCounts.needs;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-6">
          {/* Page Heading */}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              My Orders
            </h1>
            <p className="text-sm text-muted-foreground">
              {pendingCount > 0
                ? `${pendingCount} order${pendingCount !== 1 ? "s" : ""} awaiting producer response`
                : "Track orders, delivery status, and producer coordination."}
            </p>
          </div>

          {/* Active Business Context Bar */}
          <V4OrdersContextBar
            business={context.business}
            role={context.role}
            memberships={context.memberships}
          />

          {tabCounts.total === 0 ? (
            /* Global Empty State */
            <Empty data-testid="orders-empty-state" className="border border-dashed py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <RiShoppingBagLine className="size-8 text-muted-foreground/60" aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No orders yet</EmptyTitle>
                <EmptyDescription>
                  Your business has not placed any wholesale orders yet. Browse verified local producers
                  and start ordering fresh harvest directly.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link
                  href={routes.products}
                  className={buttonVariants({ variant: "default" })}
                >
                  <RiStore2Line className="size-4 mr-2" />
                  Explore Products
                  <RiArrowRightLine className="size-4 ml-1.5" />
                </Link>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Tab navigation */}
              <div
                data-testid="orders-tab-filter"
                className="flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-none pb-0.5 -mx-4 px-4 sm:mx-0 sm:px-0"
              >
                {TAB_CONFIG.map((tab) => {
                  const isActive = activeView === tab.id;
                  const count = tabCounts[tab.id];
                  const isAmber = tab.id === "needs" && count > 0;

                  return (
                    <Link
                      key={tab.id}
                      href={`/orders?view=${tab.id}`}
                      className={cn(
                        "inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap -mb-px min-h-[44px]",
                        isActive
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                      )}
                    >
                      <span>{tab.label}</span>
                      {isAmber ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold text-xs px-2 py-0.5"
                        >
                          {count}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "px-2 py-0.5 text-xs font-medium",
                            isActive
                              ? "bg-muted text-foreground"
                              : "bg-muted/60 text-muted-foreground"
                          )}
                        >
                          {count}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Order rows or tab empty state */}
              {currentOrders.length === 0 ? (
                <div
                  data-testid="tab-empty-state"
                  className="flex flex-col items-center justify-center gap-2 py-14 text-center rounded-xl border border-dashed border-border p-6 bg-card/50"
                >
                  <p className="font-semibold text-foreground">
                    {EMPTY_STATE_COPY[activeView].title}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {EMPTY_STATE_COPY[activeView].description}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card shadow-2xs">
                  {/* Table Header on sm+ */}
                  <div className="hidden sm:grid sm:grid-cols-[minmax(180px,1.2fr)_minmax(180px,1.5fr)_minmax(120px,0.9fr)_minmax(100px,0.8fr)_auto] items-center gap-4 px-4 py-2.5 text-xs font-medium text-muted-foreground bg-muted/40">
                    <div>Producer & Reference</div>
                    <div>Produce & Next Step</div>
                    <div>Fulfillment</div>
                    <div className="text-right">Total</div>
                    <div className="text-right pr-6">Status</div>
                  </div>

                  {/* List of orders */}
                  {currentOrders.map((order) => (
                    <V4OrderRow
                      key={order.id}
                      order={order}
                      isNeedsAction={activeView === "needs" && order.status === "pending"}
                    />
                  ))}
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
