import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  RiPlantLine,
  RiShoppingBagLine,
  RiArrowRightLine,
  RiWallet3Line,
  RiCheckboxCircleLine,
} from "@remixicon/react";
import Link from "next/link";
import type { UserRole } from "@/lib/constants";
import { CURRENCY } from "@/lib/constants";
import { getFarmerOrders, getFarmerOrderMetrics } from "@/lib/supabase/queries/orders";
import { getFarmerProducts } from "@/lib/supabase/queries/products";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";

export const metadata: Metadata = { title: "Farmer Dashboard" };
export const dynamic = "force-dynamic";

export default async function FarmerDashboardPage() {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "farmer" || !userId) {
    if (role === "business") redirect("/business");
    if (role === "admin") redirect("/admin");
    redirect("/onboarding");
  }

  const [metrics, products, recentOrders] = await Promise.all([
    getFarmerOrderMetrics(userId),
    getFarmerProducts(userId),
    getFarmerOrders(userId).then((o) => o.slice(0, 3)),
  ]);

  const activeProducts = products.filter((p) => p.status === "active").length;

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening with your farm today.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={`${CURRENCY}${metrics.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
          icon={<RiWallet3Line className="size-5 text-emerald-600" />}
          href="/farmer/orders"
        />
        <MetricCard
          label="Pending Orders"
          value={String(metrics.pending)}
          icon={<RiShoppingBagLine className="size-5 text-amber-600" />}
          href="/farmer/orders"
        />
        <MetricCard
          label="Fulfillment Rate"
          value={`${metrics.fulfillmentRate}%`}
          icon={<RiCheckboxCircleLine className="size-5 text-primary" />}
          href="/farmer/orders"
        />
        <MetricCard
          label="Active Products"
          value={String(activeProducts)}
          icon={<RiPlantLine className="size-5 text-primary" />}
          href="/farmer/products"
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard
          title="Add a product"
          description="List new produce with price, quantity, and availability."
          href="/farmer/products/new"
          label="Add product"
        />
        <ActionCard
          title="View orders"
          description="Review and respond to incoming orders from businesses."
          href="/farmer/orders"
          label={metrics.pending > 0 ? `View orders (${metrics.pending} pending)` : "View orders"}
        />
      </div>

      {/* Recent Orders */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
          <Link href="/farmer/orders" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
            <RiShoppingBagLine className="size-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">No orders yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Once businesses place orders, they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[380px] text-sm">
              <tbody className="divide-y divide-border">
                {recentOrders.map((order) => {
                  const bizName =
                    order.business?.business_name || order.business?.full_name || "—";
                  return (
                    <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/farmer/orders/${order.id}`}
                          className="font-mono text-xs font-medium text-foreground hover:text-primary"
                        >
                          #{order.id.slice(0, 8).toUpperCase()}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{bizName}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums whitespace-nowrap">
                        {CURRENCY}
                        {(order.total_amount ?? 0).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
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
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
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

function ActionCard({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Link
        href={href}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        {label}
        <RiArrowRightLine className="size-3.5" />
      </Link>
    </div>
  );
}
