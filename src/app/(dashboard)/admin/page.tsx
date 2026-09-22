import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  RiUserLine,
  RiStoreLine,
  RiShoppingBagLine,
  RiAlertLine,
  RiArrowRightLine,
} from "@remixicon/react";
import Link from "next/link";
import type { UserRole } from "@/lib/constants";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "admin") {
    if (role === "farmer") redirect("/farmer");
    if (role === "business") redirect("/business");
    redirect("/onboarding");
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Admin Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide status and pending actions.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Farmers" value="—" icon={<RiUserLine className="size-5 text-primary" />} href="/admin/farmers" />
        <MetricCard label="Businesses" value="—" icon={<RiStoreLine className="size-5 text-primary" />} href="/admin/businesses" />
        <MetricCard label="Active Orders" value="—" icon={<RiShoppingBagLine className="size-5 text-amber-600" />} href="/admin/orders" />
        <MetricCard label="Pending Verification" value="—" icon={<RiAlertLine className="size-5 text-destructive" />} href="/admin/verification" />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ActionCard title="Manage farmers" description="View, verify, and moderate farmer accounts." href="/admin/farmers" label="View farmers" />
        <ActionCard title="Manage businesses" description="Review and verify business registrations." href="/admin/businesses" label="View businesses" />
        <ActionCard title="Verification queue" description="Review accounts pending identity verification." href="/admin/verification" label="Open queue" />
      </div>

      {/* Recent activity placeholder */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <RiAlertLine className="size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">No activity yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Platform events will appear here.</p>
        </div>
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
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
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
      <Link href={href} className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        {label}
        <RiArrowRightLine className="size-3.5" />
      </Link>
    </div>
  );
}
