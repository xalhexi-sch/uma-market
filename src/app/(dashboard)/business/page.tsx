import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  RiShoppingBagLine,
  RiTimeLine,
  RiCoinLine,
  RiArrowRightLine,
  RiStoreLine,
} from "@remixicon/react";
import Link from "next/link";
import type { UserRole } from "@/lib/constants";
import { CURRENCY } from "@/lib/constants";
import { getBusinessOrders, getBusinessOrderMetrics } from "@/lib/supabase/queries/orders";
import { getActiveProducts } from "@/lib/supabase/queries/products";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { ProductCard } from "@/components/dashboard/product-card";

export const metadata: Metadata = { title: "Business Dashboard" };
export const dynamic = "force-dynamic";

export default async function BusinessDashboardPage() {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "business" || !userId) {
    if (role === "farmer") redirect("/farmer");
    if (role === "admin") redirect("/admin");
    redirect("/onboarding");
  }

  const [metrics, recentOrders, featuredProducts] = await Promise.all([
    getBusinessOrderMetrics(userId),
    getBusinessOrders(userId).then((o) => o.slice(0, 3)),
    getActiveProducts({ limit: 3 }),
  ]);

  const totalSpend = recentOrders.reduce(
    (sum, o) => sum + (o.total_amount ?? 0),
    0
  );

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8">
      {/* Agricultural Visual Banner */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-stretch">
          {/* Visual Accent (stacks naturally on mobile, right pane on desktop) */}
          <div className="order-1 sm:order-2 relative h-32 sm:h-auto sm:w-[38%] lg:w-[35%] shrink-0 overflow-hidden">
            <Image
              src="/dashboard-banner.jpg"
              alt="Fresh produce from local farmers in Butuan"
              fill
              priority
              sizes="(max-width: 640px) 100vw, 420px"
              className="object-cover object-[center_35%]"
            />
            {/* Seamless desktop edge blend */}
            <div className="hidden sm:block absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-card to-transparent pointer-events-none" />
            {/* Seamless mobile bottom edge blend */}
            <div className="sm:hidden absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
          </div>

          {/* Banner Content */}
          <div className="order-2 sm:order-1 flex flex-1 flex-col justify-center p-5 sm:p-6 lg:p-7 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              Direct Farm Sourcing
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Fresh produce from local farmers
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-lg">
              Source available produce and manage your wholesale orders in one place.
            </p>
            <div className="mt-4">
              <Link
                href="/business/products"
                className="group inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 active:bg-primary/95"
              >
                Browse products
                <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Active Orders"
          value={String(metrics.active)}
          icon={<RiShoppingBagLine className="size-5 text-primary" />}
          href="/business/orders"
        />
        <MetricCard
          label="Pending Delivery"
          value={String(metrics.pendingDelivery)}
          icon={<RiTimeLine className="size-5 text-amber-600" />}
          href="/business/orders"
        />
        <MetricCard
          label="Total Spend"
          value={metrics.total > 0 ? `${CURRENCY}${totalSpend.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
          icon={<RiCoinLine className="size-5 text-muted-foreground" />}
          href="/business/orders"
        />
      </div>

      {/* Recent Orders */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
          <Link href="/business/orders" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
            <RiStoreLine className="size-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">No orders placed yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Browse products and place your first order.
            </p>
            <Link
              href="/business/products"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Browse Products
              <RiArrowRightLine className="size-3" />
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {recentOrders.map((order) => {
                  const farmerName =
                    order.farmer?.business_name || order.farmer?.full_name || "—";
                  return (
                    <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/business/orders/${order.id}`}
                          className="font-mono text-xs font-medium text-foreground hover:text-primary"
                        >
                          #{order.id.slice(0, 8).toUpperCase()}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{farmerName}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                        {CURRENCY}
                        {(order.total_amount ?? 0).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Available Now</h2>
            <Link href="/business/products" className="text-xs text-primary hover:underline">
              Browse all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </Link>
  );
}
