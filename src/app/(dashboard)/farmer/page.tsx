import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiAddLine,
  RiShoppingBagLine,
  RiCoinLine,
  RiPlantLine,
  RiTeamLine,
  RiTimeLine,
  RiArrowRightLine,
  RiStore2Line,
  RiFileListLine,
  RiMessage2Line,
} from "@remixicon/react";
import type { UserRole } from "@/lib/constants";
import {
  getFarmerOverview,
  getFarmerTopProducts,
} from "@/lib/supabase/queries/overview";
import {
  getFarmerOrders,
  getFarmerPendingOrderCount,
} from "@/lib/supabase/queries/orders";
import { getFarmerActiveProductCount } from "@/lib/supabase/queries/products";
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
  TopProductsCard,
  type AttentionItem,
} from "@/components/dashboard/overview/parts";

export const metadata: Metadata = { title: "Overview — Farmer Dashboard" };
export const dynamic = "force-dynamic";

export default async function FarmerOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "farmer" || !userId) {
    if (role === "business") redirect("/business");
    if (role === "admin") redirect("/admin");
    redirect("/onboarding");
  }

  const user = await currentUser();
  const firstName = user?.firstName ?? "there";

  const params = await searchParams;
  const range = resolveOverviewRange(params);
  const { long: rangeLabel, phrase: rangePhrase } = describeRange(range);

  const [overview, activeProducts, topProducts, recentOrderRows, pendingCount] =
    await Promise.all([
      getFarmerOverview(range),
      getFarmerActiveProductCount(userId),
      getFarmerTopProducts(userId, range),
      getFarmerOrders(userId, 3),
      getFarmerPendingOrderCount(userId),
    ]);

  const inProgress = overview.status.breakdown.find((row) => row.status === "in_progress")?.count ?? 0;

  // Each item is backed by a count queried above. When they are all zero the
  // section renders nothing.
  const attention: AttentionItem[] = [];
  if (pendingCount > 0) {
    attention.push({
      id: "pending",
      label: `${pendingCount} order${pendingCount === 1 ? "" : "s"} awaiting your response`,
      detail: "Buyers are waiting for you to accept.",
      href: "/farmer/orders?view=needs",
      action: "Review",
      icon: <RiTimeLine className="size-4" />,
      tone: "warn",
    });
  }
  if (inProgress > 0) {
    attention.push({
      id: "progress",
      label: `${inProgress} order${inProgress === 1 ? "" : "s"} in progress`,
      detail: "Update the status as you prepare or deliver.",
      href: "/farmer/orders?view=progress",
      action: "View",
      icon: <RiShoppingBagLine className="size-4" />,
      tone: "info",
    });
  }
  if (activeProducts === 0) {
    attention.push({
      id: "products",
      label: "No active listings",
      detail: "Buyers cannot find your produce until you publish one.",
      href: "/farmer/products/new",
      action: "Add product",
      icon: <RiPlantLine className="size-4" />,
      tone: "warn",
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
              : `${overview.metrics.orders} order${overview.metrics.orders === 1 ? "" : "s"} · ${formatPeso(overview.metrics.revenue)} revenue · ${rangePhrase}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeControl activeKey={range.key} from={params.from} to={params.to} />
          <Link href="/farmer/products/new" className={buttonVariants()}>
            <RiAddLine className="size-4" />
            Add product
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
          label="Revenue"
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
          label="Active customers"
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
              <CardTitle>Sales &amp; orders</CardTitle>
              <CardDescription>
                Completed revenue and order volume, {rangePhrase}.
              </CardDescription>
            </div>
            <CardAction>
              <span className="text-xs text-muted-foreground">{activeProducts} active listings</span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <SalesChartSection data={overview.chart} />
          </CardContent>
        </Card>

        <OrderStatusCard
          breakdown={overview.status.breakdown}
          total={overview.status.total}
          rangeLabel={rangeLabel}
          rangePhrase={rangePhrase}
          ordersHref="/farmer/orders"
        />
      </section>

      {/* ── Recent orders ───────────────────────────── */}
      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Recent orders"
          description="Your three most recent orders."
          action={
            <Link
              href="/farmer/orders"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View all
              <RiArrowRightLine className="size-3.5" />
            </Link>
          }
        />
        <RecentOrderList
          orders={recentOrderRows}
          role="farmer"
          actionHref="/farmer/products"
          actionLabel="List a product"
          emptyTitle="No orders yet"
          emptyDescription="When a business places a wholesale order for your produce, it will appear here."
        />
      </section>

      {/* ── Top products + actions ──────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <TopProductsCard
          products={topProducts}
          rangePhrase={rangePhrase}
          productsHref="/farmer/products"
        />
        <QuickActions
          items={[
            { href: "/farmer/products/new", label: "Add product", icon: <RiAddLine className="size-4" /> },
            { href: "/farmer/products", label: "Manage products", icon: <RiStore2Line className="size-4" /> },
            { href: "/farmer/orders", label: "View orders", icon: <RiFileListLine className="size-4" /> },
            { href: "/farmer/messages", label: "Messages", icon: <RiMessage2Line className="size-4" /> },
          ]}
        />
      </section>
    </div>
  );
}