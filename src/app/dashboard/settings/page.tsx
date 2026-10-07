import type { Metadata } from "next";
import { WorkspacePageShell } from "@/components/dashboard/workspace-page-shell";
import { V4DashboardContextBar } from "@/components/dashboard/v4-dashboard-context-bar";
import { V4WorkspaceNav } from "@/components/dashboard/v4-workspace-nav";
import { BusinessSettingsClient } from "@/components/dashboard/settings/business-settings-client";
import { requireWorkspaceBusiness } from "../_lib/require-workspace-business";

export const metadata: Metadata = {
  title: "Business Settings — UMA Market",
  description: "Manage business identity, capabilities, and staff for your active business.",
};

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage() {
  const context = await requireWorkspaceBusiness();
  const { business, role, canBuy, canSell, isOwner, memberships } = context;

  return (
    <WorkspacePageShell>
      <div>
        <h1
          data-testid="settings-page-title"
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          Business Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage business identity, capabilities, and operational preferences for{" "}
          <span className="font-semibold text-foreground">{business.name}</span>.
        </p>
      </div>

      <V4DashboardContextBar
        business={business}
        role={role}
        canBuy={canBuy}
        canSell={canSell}
        memberships={memberships}
      />

      <V4WorkspaceNav active="settings" canSell={canSell} />

      <BusinessSettingsClient
        business={business}
        role={role}
        isOwner={isOwner}
        canBuy={canBuy}
        canSell={canSell}
      />
    </WorkspacePageShell>
  );
}
