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
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-stone-900 shadow-xs">
        <div className="relative min-h-[160px] sm:min-h-[175px] md:min-h-[185px] w-full overflow-hidden flex items-center px-5 py-6 sm:px-8">
          <Image
            src="/dashboard-banner.jpg"
            alt="Fresh produce from local farmers in Butuan"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1200px"
            className="object-cover object-[center_35%] sm:object-[center_30%]"
          />
          {/* Base darkening scrim for consistent contrast */}
          <div className="absolute inset-0 bg-stone-950/30" />
          {/* Directional gradient: vertical-up on mobile, left-to-right on larger screens */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/80 to-stone-950/40 sm:bg-gradient-to-r sm:from-stone-950/95 sm:via-stone-950/75 sm:to-transparent" />
          {/* Inner highlight ring */}
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />

          {/* Banner content */}
          <div className="relative z-10 flex flex-col justify-center text-white">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              Butuan Agricultural Network
            </span>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
              Fresh produce from local farmers
            </h2>
            <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-stone-200 sm:text-sm">
              Source available produce, check supply, and manage your wholesale orders in one place.
            </p>
            <div className="mt-3.5">
              <Link
                href="/business/products"
                className="group/cta inline-flex items-center gap-1.5 rounded-md bg-white/95 px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-xs transition-colors hover:bg-white active:bg-neutral-100"
              >
                Browse products
                <RiArrowRightLine className="size-3.5 transition-transform group-hover/cta:translate-x-0.5" />
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
