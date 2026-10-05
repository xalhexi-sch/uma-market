import Link from "next/link";
import type { Metadata } from "next";
import { RiAddLine, RiPlantLine, RiSearchLine } from "@remixicon/react";
import { WorkspacePageShell } from "@/components/dashboard/workspace-page-shell";
import { V4DashboardContextBar } from "@/components/dashboard/v4-dashboard-context-bar";
import { V4WorkspaceNav } from "@/components/dashboard/v4-workspace-nav";
import { SellingCapabilityRequired } from "@/components/dashboard/selling-capability-required";
import { ListingRow, ListingRowHeader } from "@/components/dashboard/listings/listing-row";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getBusinessListings } from "@/lib/supabase/queries/listings";
import {
  countListings,
  filterAndSortListings,
  LISTING_SORTS,
  LISTING_VIEWS,
  type ListingSort,
  type ListingView,
} from "@/lib/listings";
import { routes } from "@/platform/routes";
import { cn } from "@/lib/utils";
import { requireWorkspaceBusiness } from "../_lib/require-workspace-business";

export const metadata: Metadata = {
  title: "Listings — UMA Market",
  description: "Manage what your business sells on UMA Market.",
};

export const dynamic = "force-dynamic";

const VIEW_TABS: Array<{ id: ListingView; label: string }> = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "drafts", label: "Drafts" },
  { id: "attention", label: "Needs attention" },
  { id: "archived", label: "Archived" },
];

const SORT_LABELS: Record<ListingSort, string> = {
  updated: "Recently updated",
  name: "Name (A–Z)",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  stock_asc: "Stock: lowest first",
};

const MAX_QUERY_LENGTH = 100;

function listingsHref(params: { view: ListingView; q: string; sort: ListingSort }): string {
  const search = new URLSearchParams();
  if (params.view !== "all") search.set("view", params.view);
  if (params.q) search.set("q", params.q);
  if (params.sort !== "updated") search.set("sort", params.sort);
  const qs = search.toString();
  return qs ? `${routes.dashboard.listings}?${qs}` : routes.dashboard.listings;
}

interface PageProps {
  searchParams: Promise<{ view?: string; q?: string; sort?: string }>;
}

export default async function ListingsPage({ searchParams }: PageProps) {
  const context = await requireWorkspaceBusiness();
  const { business, role, canBuy, canSell, memberships } = context;

  const header = (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What <span className="font-semibold text-foreground">{business.name}</span> is selling on UMA.
          </p>
        </div>
        {canSell && (
          <Link href={routes.dashboard.newListing} className={cn(buttonVariants(), "h-10 sm:h-8")}>
            <RiAddLine aria-hidden="true" />
            New listing
          </Link>
        )}
      </div>
      <V4DashboardContextBar
        business={business}
        role={role}
        canBuy={canBuy}
        canSell={canSell}
        memberships={memberships}
      />
      <V4WorkspaceNav active="listings" canSell={canSell} />
    </>
  );

  if (!canSell) {
    return (
      <WorkspacePageShell>
        {header}
        <SellingCapabilityRequired businessName={business.name} area="listings" />
      </WorkspacePageShell>
    );
  }

  const params = await searchParams;
  const view: ListingView = LISTING_VIEWS.includes(params.view as ListingView)
    ? (params.view as ListingView)
    : "all";
  const sort: ListingSort = LISTING_SORTS.includes(params.sort as ListingSort)
    ? (params.sort as ListingSort)
    : "updated";
  const q = (params.q ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  const listings = await getBusinessListings(business.id);
  const counts = countListings(listings);
  const visible = filterAndSortListings(listings, { view, query: q, sort });
  const hasAnyListing = listings.length > 0;

  return (
    <WorkspacePageShell>
      {header}

      {!hasAnyListing ? (
        <div
          data-testid="listings-empty-state"
          className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center"
        >
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <RiPlantLine className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">You&apos;re not selling anything yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first listing with a price, minimum order and opening stock. Buyers see it as soon as you
            publish.
          </p>
          <Link href={routes.dashboard.newListing} className={cn(buttonVariants(), "mt-5 h-10 sm:h-8")}>
            <RiAddLine aria-hidden="true" />
            Create a listing
          </Link>
        </div>
      ) : (
        <section aria-labelledby="listings-heading" className="space-y-4">
          <h2 id="listings-heading" className="sr-only">
            Your listings
          </h2>

          <nav aria-label="Filter listings" data-testid="listings-view-tabs">
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {VIEW_TABS.map((tab) => {
                const isActive = tab.id === view;
                return (
                  <li key={tab.id} className="shrink-0">
                    <Link
                      href={listingsHref({ view: tab.id, q, sort })}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {tab.label}
                      <Badge
                        variant={isActive ? "secondary" : "outline"}
                        className={cn(
                          "h-4 min-w-5 justify-center px-1.5 text-[10px] tabular-nums",
                          isActive && "border-transparent bg-primary-foreground/20 text-primary-foreground",
                          !isActive && tab.id === "attention" && counts.attention > 0 && "border-amber-500/50 text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {counts[tab.id]}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {view === "attention" && (
            <p className="text-sm text-muted-foreground">
              Live listings buyers can&apos;t fully order because of stock, and listings under UMA review.
            </p>
          )}

          <form
            role="search"
            action={routes.dashboard.listings}
            method="get"
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            {view !== "all" && <input type="hidden" name="view" value={view} />}
            <div className="relative flex-1">
              <RiSearchLine
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                name="q"
                type="search"
                defaultValue={q}
                maxLength={MAX_QUERY_LENGTH}
                placeholder="Search by name or category"
                aria-label="Search listings"
                className="h-10 pl-8 sm:h-8"
              />
            </div>
            <div className="flex gap-2">
              <label htmlFor="listings-sort" className="sr-only">
                Sort listings
              </label>
              <NativeSelect id="listings-sort" name="sort" defaultValue={sort} className="flex-1 sm:flex-none">
                {LISTING_SORTS.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {SORT_LABELS[option]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button type="submit" variant="outline" className="h-10 sm:h-8">
                Apply
              </Button>
            </div>
          </form>

          {visible.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
              <ListingRowHeader />
              <ul data-testid="listings-list" className="divide-y divide-border">
                {visible.map((listing) => (
                  <ListingRow key={listing.id} listing={listing} />
                ))}
              </ul>
            </div>
          ) : (
            <div
              data-testid="listings-filter-empty"
              className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center"
            >
              <h3 className="text-sm font-semibold text-foreground">No listings match</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {q ? `Nothing in this view matches “${q}”.` : "There are no listings in this view."}
              </p>
              <Link
                href={routes.dashboard.listings}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
              >
                Show all listings
              </Link>
            </div>
          )}
        </section>
      )}
    </WorkspacePageShell>
  );
}
