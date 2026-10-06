import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiShoppingBagLine,
  RiCoinLine,
  RiTeamLine,
  RiTimeLine,
  RiArrowRightLine,
  RiStoreLine,
  RiFileListLine,
  RiShoppingCart2Line,
  RiMessage2Line,
  RiTruckLine,
} from "@remixicon/react";
import type { UserRole } from "@/lib/constants";
import { routes } from "@/platform/routes";
import { getBusinessOverview } from "@/lib/supabase/queries/overview";
import {
  getBusinessOrders,
  getBusinessActiveOrderCount,
} from "@/lib/supabase/queries/orders";
import { getCartItemCount } from "@/lib/supabase/queries/cart";
import { resolveOverviewRange } from "@/lib/overview-range";
import { getManilaGreeting } from "@/lib/time";
import { describeRange, formatPeso } from "@/lib/overview-format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { RecentOrderList } from "@/components/dashboard/recent-order-list";
import { SalesChartSection } from "@/components/dashboard/sales-chart-section";
import { RangeControl } from "@/components/dashboard/overview/range-control";
import {
  AttentionList,
  KpiTile,
  OrderStatusCard,
  QuickActions,
  SectionHeading,
  type AttentionItem,
} from "@/components/dashboard/overview/parts";

export const metadata: Metadata = { title: "Overview — Business Dashboard" };
export const dynamic = "force-dynamic";

export default async function BusinessOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "business" || !userId) {
    if (role === "farmer") redirect("/farmer");
    if (role === "admin") redirect("/admin");
    redirect("/onboarding");
  }

  const user = await currentUser();
  const firstName = user?.firstName ?? "there";

  const params = await searchParams;
  const range = resolveOverviewRange(params);
  const { long: rangeLabel, phrase: rangePhrase } = describeRange(range);

  const [overview, recentOrderRows, readyCount, cartCount] = await Promise.all([
    getBusinessOverview(range),
    getBusinessOrders(userId, 3),
    getBusinessActiveOrderCount(userId),
    getCartItemCount(userId),
  ]);

  const pendingCount =
    overview.status.breakdown.find((row) => row.status === "pending")?.count ?? 0;

  // Each item is backed by a count queried above. When they are all zero the
  // section renders nothing.
  const attention: AttentionItem[] = [];
  if (pendingCount > 0) {
    attention.push({
      id: "pending",
      label: `${pendingCount} order${pendingCount === 1 ? "" : "s"} awaiting confirmation`,
      detail: "Sellers have not responded yet.",
      href: "/business/orders?view=needs",
      action: "Review",
      icon: <RiTimeLine className="size-4" />,
      tone: "warn",
    });
  }
  if (readyCount > 0) {
    attention.push({
      id: "ready",
      label: `${readyCount} order${readyCount === 1 ? "" : "s"} ready or out for delivery`,
      detail: "Arrange pickup or delivery.",
      href: "/business/orders?view=progress",
      action: "View",
      icon: <RiTruckLine className="size-4" />,
      tone: "info",
    });
  }
  if (cartCount > 0) {
    attention.push({
      id: "cart",
      label: `${cartCount} item${cartCount === 1 ? "" : "s"} still in your cart`,
      detail: "Checkout before the seller runs out.",
      href: routes.cart,
      action: "Review cart",
      icon: <RiShoppingCart2Line className="size-4" />,
      tone: "info",
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* ── Header ─────────────────────────────────── */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {getManilaGreeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {overview.metrics.orders === 0
              ? `No orders ${rangePhrase}.`
              : `${overview.metrics.orders} order${overview.metrics.orders === 1 ? "" : "s"} · ${formatPeso(overview.metrics.revenue)} spend · ${rangePhrase}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeControl activeKey={range.key} from={params.from} to={params.to} />
          <Link href="/business/products" className={buttonVariants()}>
            <RiStoreLine className="size-4" />
            Browse products
          </Link>
        </div>
      </header>

      {/* ── KPIs ────────────────────────────────────── */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4"
      >
        <KpiTile
          label="Orders"
          value={String(overview.metrics.orders)}
          current={overview.metrics.orders}
          previous={overview.metrics.previous.orders}
          icon={<RiShoppingBagLine className="size-4" />}
          iconClassName="bg-primary/10 text-primary"
        />
        <KpiTile
          label="Spend"
          value={formatPeso(overview.metrics.revenue)}
          current={overview.metrics.revenue}
          previous={overview.metrics.previous.revenue}
          icon={<RiCoinLine className="size-4" />}
          iconClassName="bg-primary/10 text-primary"
        />
        <KpiTile
          label="Pipeline"
          value={String(overview.metrics.pipeline)}
          current={overview.metrics.pipeline}
          previous={overview.metrics.previous.pipeline}
          icon={<RiTimeLine className="size-4" />}
          iconClassName="bg-primary/10 text-primary"
          footnote="Open orders in range"
        />
        <KpiTile
          label="Sellers connected"
          value={String(overview.metrics.activeBuyers)}
          current={overview.metrics.activeBuyers}
          previous={overview.metrics.previous.activeBuyers}
          icon={<RiTeamLine className="size-4" />}
          iconClassName="bg-primary/10 text-primary"
        />
      </section>

      {/* ── Needs attention ─────────────────────────── */}
      <AttentionList items={attention} />

      {/* ── Trend + status ──────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0">
          <CardHeader>
            <div>
              <CardTitle>Spending &amp; orders</CardTitle>
              <CardDescription>
                Completed spend and order volume, {rangePhrase}.
              </CardDescription>
            </div>
            <CardAction>
              <span className="text-xs text-muted-foreground">
                {overview.metrics.productsListed} products available
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <SalesChartSection
              data={overview.chart}
              seriesLabel={{ sales: "Spend", orders: "Orders" }}
            />
          </CardContent>
        </Card>

        <OrderStatusCard
          breakdown={overview.status.breakdown}
          total={overview.status.total}
          rangeLabel={rangeLabel}
          rangePhrase={rangePhrase}
          ordersHref="/business/orders"
        />
      </section>

      {/* ── Recent orders ───────────────────────────── */}
      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Recent orders"
          description="Your three most recent orders."
          action={
            <Link
              href="/business/orders"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View all
              <RiArrowRightLine className="size-3.5" />
            </Link>
          }
        />
        <RecentOrderList
          orders={recentOrderRows}
          role="business"
          actionHref="/business/products"
          actionLabel="Browse products"
          emptyTitle="No orders yet"
          emptyDescription="Browse available produce and place your first wholesale order."
        />
      </section>

      {/* ── Quick actions ───────────────────────────── */}
      <QuickActions
        items={[
          { href: "/business/products", label: "Browse products", icon: <RiStoreLine className="size-4" /> },
          { href: routes.cart, label: "View cart", icon: <RiShoppingCart2Line className="size-4" /> },
          { href: "/business/orders", label: "View orders", icon: <RiFileListLine className="size-4" /> },
          { href: "/business/messages", label: "Messages", icon: <RiMessage2Line className="size-4" /> },
        ]}
      />
    </div>
  );
}