import Link from "next/link";
import type { Metadata } from "next";
import { RiAddLine, RiCheckboxCircleLine, RiStackLine } from "@remixicon/react";
import { WorkspacePageShell } from "@/components/dashboard/workspace-page-shell";
import { V4DashboardContextBar } from "@/components/dashboard/v4-dashboard-context-bar";
import { V4WorkspaceNav } from "@/components/dashboard/v4-workspace-nav";
import { SellingCapabilityRequired } from "@/components/dashboard/selling-capability-required";
import { StockRow } from "@/components/dashboard/inventory/stock-row";
import { InventoryActivity } from "@/components/dashboard/inventory/inventory-activity";
import { buttonVariants } from "@/components/ui/button";
import { getBusinessListings } from "@/lib/supabase/queries/listings";
import { getRecentInventoryMovements } from "@/lib/supabase/queries/inventory";
import { STOCK_STATE_LABELS, STOCK_STATE_PRIORITY, type StockState } from "@/lib/inventory";
import { routes } from "@/platform/routes";
import { cn } from "@/lib/utils";
import { requireWorkspaceBusiness } from "../_lib/require-workspace-business";

export const metadata: Metadata = {
  title: "Inventory — UMA Market",
  description: "See what needs restocking and record stock changes for your business.",
};

export const dynamic = "force-dynamic";

const ATTENTION_STATES: Array<Exclude<StockState, "ok">> = ["out", "below_moq", "low"];

export default async function InventoryPage() {
  const context = await requireWorkspaceBusiness();
  const { business, role, canBuy, canSell, memberships } = context;

  const header = (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What <span className="font-semibold text-foreground">{business.name}</span> needs to restock or fix.
        </p>
      </div>
      <V4DashboardContextBar
        business={business}
        role={role}
        canBuy={canBuy}
        canSell={canSell}
        memberships={memberships}
      />
      <V4WorkspaceNav active="inventory" canSell={canSell} />
    </>
  );

  if (!canSell) {
    return (
      <WorkspacePageShell>
        {header}
        <SellingCapabilityRequired businessName={business.name} area="inventory" />
      </WorkspacePageShell>
    );
  }

  const [listings, movements] = await Promise.all([
    getBusinessListings(business.id),
    getRecentInventoryMovements(business.id),
  ]);

  const byPriority = (a: (typeof listings)[number], b: (typeof listings)[number]) =>
    STOCK_STATE_PRIORITY[a.stockState] - STOCK_STATE_PRIORITY[b.stockState] ||
    a.quantity_available - b.quantity_available ||
    a.name.localeCompare(b.name);

  // Archived listings are out of the catalogue; their stock isn't actionable.
  const stocked = listings.filter((l) => l.status !== "archived").sort(byPriority);
  // Only live listings block buyers, so only they are urgent.
  const attention = stocked.filter((l) => l.status === "active" && l.stockState !== "ok");
  const attentionCounts = ATTENTION_STATES.map((state) => ({
    state,
    count: attention.filter((l) => l.stockState === state).length,
  })).filter((entry) => entry.count > 0);

  return (
    <WorkspacePageShell>
      {header}

      {stocked.length === 0 ? (
        <div
          data-testid="inventory-empty-state"
          className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center"
        >
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <RiStackLine className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">No stock to manage yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Inventory follows your listings. Create a listing with its opening stock to start tracking.
          </p>
          <Link href={routes.dashboard.newListing} className={cn(buttonVariants(), "mt-5 h-10 sm:h-8")}>
            <RiAddLine aria-hidden="true" />
            Create a listing
          </Link>
        </div>
      ) : (
        <>
          <section aria-labelledby="attention-heading" data-testid="inventory-attention" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="attention-heading" className="text-base font-semibold tracking-tight text-foreground">
                Needs restocking
              </h2>
              {attentionCounts.length > 0 && (
                <p className="text-xs text-muted-foreground" data-testid="inventory-attention-summary">
                  {attentionCounts
                    .map(({ state, count }) => `${count} ${STOCK_STATE_LABELS[state].toLowerCase()}`)
                    .join(" · ")}
                </p>
              )}
            </div>

            {attention.length > 0 ? (
              <ul className="divide-y divide-amber-500/20 rounded-xl border border-amber-500/30 bg-amber-500/5 shadow-2xs">
                {attention.map((listing) => (
                  <StockRow key={listing.id} listing={listing} emphasize />
                ))}
              </ul>
            ) : (
              <div
                data-testid="inventory-all-clear"
                className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm"
              >
                <RiCheckboxCircleLine
                  className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <p className="text-foreground">Every live listing has enough stock for buyers to order.</p>
              </div>
            )}
          </section>

          <section aria-labelledby="stock-heading" className="space-y-3">
            <div>
              <h2 id="stock-heading" className="text-base font-semibold tracking-tight text-foreground">
                All stock
              </h2>
              <p className="text-xs text-muted-foreground">
                Live and draft listings. Every change is recorded below.
              </p>
            </div>
            <ul
              data-testid="inventory-stock-list"
              className="divide-y divide-border rounded-xl border border-border bg-card shadow-2xs"
            >
              {stocked.map((listing) => (
                <StockRow key={listing.id} listing={listing} />
              ))}
            </ul>
          </section>
        </>
      )}

      <section aria-labelledby="activity-heading" className="space-y-3">
        <h2 id="activity-heading" className="text-base font-semibold tracking-tight text-foreground">
          Recent stock activity
        </h2>
        <InventoryActivity movements={movements} currentUserId={context.user.userId} />
      </section>
    </WorkspacePageShell>
  );
}
