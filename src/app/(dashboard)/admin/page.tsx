import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  RiPlantLine,
  RiStoreLine,
  RiShoppingBagLine,
  RiMoneyDollarCircleLine,
  RiShieldCheckLine,
  RiArrowRightLine,
} from "@remixicon/react";
import Link from "next/link";
import { getAdminMetrics } from "@/lib/supabase/queries/admin";
import { CURRENCY } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Admin Dashboard — UMA Market",
  description: "Platform-wide operations, metrics, and marketplace governance.",
};

export default async function AdminDashboardPage() {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "admin") {
    if (role === "farmer") redirect("/farmer");
    if (role === "business") redirect("/business");
    redirect("/onboarding");
  }

  const metrics = await getAdminMetrics();

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-6xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <RiShieldCheckLine className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Platform Administration
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide health, marketplace participants, and regional trade metrics for Butuan City.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Registered Farmers"
          value={metrics.totalFarmers.toString()}
          icon={<RiPlantLine className="size-5 text-emerald-600" />}
          href="/admin/farmers"
          description="Local farm suppliers"
        />
        <MetricCard
          label="Commercial Buyers"
          value={metrics.totalBusinesses.toString()}
          icon={<RiStoreLine className="size-5 text-blue-600" />}
          href="/admin/businesses"
          description="Restaurants, hotels & caterers"
        />
        <MetricCard
          label="Listed Produce"
          value={metrics.totalProducts.toString()}
          icon={<RiShoppingBagLine className="size-5 text-amber-600" />}
          href="/admin/products"
          description="Active agricultural listings"
        />
        <MetricCard
          label="Wholesale Volume"
          value={`${CURRENCY}${metrics.totalVolume.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
          icon={<RiMoneyDollarCircleLine className="size-5 text-primary" />}
          href="/admin/orders"
          description="Gross marketplace orders"
        />
      </div>

      {/* Quick management hubs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard
          title="Produce Moderation"
          description="Audit agricultural crop listings, review pricing per kg/unit, and toggle listing active/archived status."
          href="/admin/products"
          label="Review Produce Catalog"
          icon={<RiShoppingBagLine className="size-5 text-primary" />}
        />
        <ActionCard
          title="Wholesale Order Audits"
          description="Inspect live purchase orders, monitor pickup and seller delivery execution, and review order timelines."
          href="/admin/orders"
          label="View All Orders"
          icon={<RiStoreLine className="size-5 text-primary" />}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  href,
  description,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  href: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </Link>
  );
}

function ActionCard({
  title,
  description,
  href,
  label,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm">
      <div>
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <div className="mt-6">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <span>{label}</span>
          <RiArrowRightLine className="size-4" />
        </Link>
      </div>
    </div>
  );
}
