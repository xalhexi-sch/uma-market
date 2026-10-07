import type { Metadata } from "next";
import { WorkspacePageShell } from "@/components/dashboard/workspace-page-shell";
import { V4DashboardContextBar } from "@/components/dashboard/v4-dashboard-context-bar";
import { V4WorkspaceNav } from "@/components/dashboard/v4-workspace-nav";
import { BusinessMembersClient } from "@/components/dashboard/members/business-members-client";
import { requireWorkspaceBusiness } from "../_lib/require-workspace-business";
import {
  getBusinessMembers,
  getBusinessPendingInvitations,
} from "@/platform";

export const metadata: Metadata = {
  title: "Team & Members — UMA Market",
  description: "View and manage authorized staff members for your active business.",
};

export const dynamic = "force-dynamic";

export default async function BusinessMembersPage() {
  const context = await requireWorkspaceBusiness();
  const { business, role, canBuy, canSell, isOwner, memberships } = context;

  // Concurrently fetch active members and pending invitations (if OWNER)
  const [members, pendingInvitations] = await Promise.all([
    getBusinessMembers(business.id, context.user.userId),
    isOwner ? getBusinessPendingInvitations(business.id) : Promise.resolve([]),
  ]);

  return (
    <WorkspacePageShell>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="members-page-title">
          Team & Members
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View authorized operators and manage staff for{" "}
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

      <V4WorkspaceNav active="members" canSell={canSell} />

      <BusinessMembersClient
        business={business}
        role={role}
        isOwner={isOwner}
        members={members}
        pendingInvitations={pendingInvitations}
      />
    </WorkspacePageShell>
  );
}
