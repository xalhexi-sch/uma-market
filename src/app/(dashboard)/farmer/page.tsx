import Image from "next/image";
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
import { getFarmerActiveProductCount } from "@/lib/supabase/queries/products";
import { RecentOrderList } from "@/components/dashboard/recent-order-list";

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

  const [metrics, activeProducts, recentOrders] = await Promise.all([
    getFarmerOrderMetrics(userId),
    getFarmerActiveProductCount(userId),
    getFarmerOrders(userId, 3),
  ]);

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8">
      {/* Agricultural Visual Banner */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-stretch">
          {/* Visual Accent (stacks naturally on mobile, right pane on desktop) */}
          <div className="order-1 sm:order-2 relative h-32 sm:h-auto sm:w-[38%] lg:w-[35%] shrink-0 overflow-hidden">
            <Image
              src="/hero-farmer-sunrise.jpg"
              alt="Local farmer harvesting fresh produce in Butuan"
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
              Grower Operations Desk
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Direct farm trade for Butuan producers
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-lg">
              Manage your harvest inventory, respond to wholesale buyers, and fulfill orders at farm-gate pricing.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <Link
                href="/farmer/products/new"
                className="group inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 active:bg-primary/95"
              >
                Add produce
                <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/farmer/orders"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50"
              >
                View orders
              </Link>
            </div>
          </div>
        </div>
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
        <RecentOrderList
          orders={recentOrders}
          role="farmer"
          emptyTitle="No orders yet."
          emptyDescription="When commercial businesses place wholesale orders for your produce, they'll appear here."
          actionHref="/farmer/products"
          actionLabel="Manage Produce"
        />
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
