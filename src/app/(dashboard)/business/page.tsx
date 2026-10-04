import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiShoppingBagLine,
  RiCoinLine,
  RiStoreLine,
  RiTeamLine,
  RiArrowRightLine,
  RiFileListLine,
  RiShoppingCart2Line,
  RiMessage2Line,
  RiMoreLine,
} from "@remixicon/react";
import type { UserRole } from "@/lib/constants";
import { APP_TIME_ZONE, CURRENCY } from "@/lib/constants";
import {
  getBusinessOverview,
  toRecentOverviewOrder,
} from "@/lib/supabase/queries/overview";
import { getBusinessOrders } from "@/lib/supabase/queries/orders";
import { resolveOverviewRange } from "@/lib/overview-range";
import { getManilaGreeting } from "@/lib/time";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { SalesChartSection } from "@/components/dashboard/sales-chart-section";
import { OrderStatusDonut } from "@/components/dashboard/overview-charts";

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

  const range = resolveOverviewRange(await searchParams);

  const [overview, recentOrderRows] = await Promise.all([
    getBusinessOverview(range),
    getBusinessOrders(userId, 3),
  ]);
  const recentOrders = recentOrderRows.map(toRecentOverviewOrder);
  const greeting = getManilaGreeting();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1400px]">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {greeting}, {firstName} 🛒
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Here&apos;s an overview of your procurement activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/business/products">
            <Button size="default">
              <RiStoreLine className="size-4 mr-1" />
              Browse Products
            </Button>
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KPICard
          label="Total Orders"
          value={String(overview.metrics.orders)}
          icon={<RiShoppingBagLine className="size-4" />}
          iconBgClass="bg-primary/10 text-primary"
        />
        <KPICard
          label="Total Spend"
          value={`${CURRENCY}${overview.metrics.revenue.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={<RiCoinLine className="size-4" />}
          iconBgClass="bg-emerald-500/10 text-emerald-600"
        />
        <KPICard
          label="Products Available"
          value={String(overview.metrics.productsListed)}
          icon={<RiStoreLine className="size-4" />}
          iconBgClass="bg-amber-500/10 text-amber-600"
        />
        <KPICard
          label="Sellers Connected"
          value={String(overview.metrics.activeBuyers)}
          icon={<RiTeamLine className="size-4" />}
          iconBgClass="bg-sky-500/10 text-sky-600"
        />
      </div>

      {/* ── Charts Row ─────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Spending & Orders</CardTitle>
            <CardDescription>
              Your total spending and order volume over time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChartSection data={overview.chart} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Total orders this month.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {overview.status.total > 0 ? (
              <>
                <OrderStatusDonut
                  data={overview.status.breakdown}
                  total={overview.status.total}
                />
                <div className="grid w-full gap-1.5">
                  {overview.status.breakdown.map((item) => (
                    <div
                      key={item.status}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-muted-foreground">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="font-medium text-foreground">
                          {item.count}
                        </span>
                        <span className="text-muted-foreground w-8 text-right">
                          {overview.status.total > 0
                            ? `${Math.round((item.count / overview.status.total) * 100)}%`
                            : "0%"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground">No orders yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Orders Table ────────────────────── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>
              Your latest procurement orders on UMA Market.
            </CardDescription>
          </div>
          <CardAction>
            <Link href="/business/orders">
              <Button variant="outline" size="sm">
                View All Orders
                <RiArrowRightLine className="size-3.5 ml-1" />
              </Button>
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link
                            href={`/business/orders/${order.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            #{order.id.slice(0, 8).toUpperCase()}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground text-xs">
                              {order.buyerName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {order.buyerCity}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs text-foreground">
                              {order.productName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {order.productQuantity}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {CURRENCY}
                          {order.amount.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(order.date).toLocaleDateString("en-PH", {
                            timeZone: APP_TIME_ZONE,
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          <br />
                          <span className="text-[11px]">
                            {new Date(order.date).toLocaleTimeString("en-PH", {
                              timeZone: APP_TIME_ZONE,
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Stacked Cards */}
              <div className="flex flex-col gap-3 sm:hidden">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/business/orders/${order.id}`}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-xs text-primary">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">
                        {order.buyerName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.productName} · {order.productQuantity}
                      </p>
                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <span className="font-medium tabular-nums">
                          {CURRENCY}
                          {order.amount.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(order.date).toLocaleDateString("en-PH", {
                            timeZone: APP_TIME_ZONE,
                            month: "short",
                            day: "numeric",
                          })}
                          ,{" "}
                          {new Date(order.date).toLocaleTimeString("en-PH", {
                            timeZone: APP_TIME_ZONE,
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </div>
                    </div>
                    <RiMoreLine className="size-4 text-muted-foreground shrink-0 mt-1" />
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RiShoppingBagLine className="size-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-foreground">
                No orders yet
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Browse available produce and place your first wholesale order.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quick Actions ──────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks to manage your procurement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickAction
              href="/business/products"
              icon={<RiStoreLine className="size-5" />}
              title="Browse Products"
              description="Find produce from local farmers."
            />
            <QuickAction
              href="/business/cart"
              icon={<RiShoppingCart2Line className="size-5" />}
              title="View Cart"
              description="Review items in your cart."
            />
            <QuickAction
              href="/business/orders"
              icon={<RiFileListLine className="size-5" />}
              title="View Orders"
              description="Track your current orders."
            />
            <QuickAction
              href="/business/messages"
              icon={<RiMessage2Line className="size-5" />}
              title="Messages"
              description="Chat with your sellers."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ────────────────────────────────

function KPICard({
  label,
  value,
  icon,
  iconBgClass,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBgClass: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="pt-1">
        <div className="flex items-center justify-between mb-2">
          <div
            className={`flex size-8 items-center justify-center rounded-lg ${iconBgClass}`}
          >
            {icon}
          </div>
        </div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-4 text-center transition-all hover:border-primary/20 hover:bg-primary/5 hover:shadow-sm"
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground hidden sm:block">
          {description}
        </p>
      </div>
      <RiArrowRightLine className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
