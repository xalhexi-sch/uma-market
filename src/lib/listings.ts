/**
 * UMA V4 — Listing view rules for /dashboard/listings and /dashboard/inventory.
 *
 * Pure and deterministic (no I/O): classification, tab counts, search and sort
 * over listings already loaded through RLS (see lib/supabase/queries/listings).
 */

import type { ProductStatus } from "@/lib/constants";
import { getStockState, STOCK_STATE_PRIORITY, type StockState } from "@/lib/inventory";

export type ModerationStatus = "approved" | "flagged" | "suspended";

export type ListingView = "all" | "live" | "drafts" | "attention" | "archived";
export type ListingSort = "updated" | "name" | "price_asc" | "price_desc" | "stock_asc";

export const LISTING_VIEWS: ListingView[] = ["all", "live", "drafts", "attention", "archived"];
export const LISTING_SORTS: ListingSort[] = ["updated", "name", "price_asc", "price_desc", "stock_asc"];

export interface BusinessListing {
  id: string;
  name: string;
  status: ProductStatus;
  moderation_status: ModerationStatus;
  price_per_unit: number;
  unit: string;
  quantity_available: number;
  min_order_quantity: number;
  image_path: string | null;
  image_url: string | null;
  updated_at: string;
  category: { id: string; name: string; slug: string } | null;
  stockState: StockState;
  /** Live listing that buyers can't fully order, or a listing under UMA review. */
  needsAttention: boolean;
}

export type ListingCounts = Record<ListingView, number>;

/** Derives stock state and attention from the stored listing fields. */
export function toBusinessListing(
  fields: Omit<BusinessListing, "stockState" | "needsAttention">
): BusinessListing {
  const stockState = getStockState(fields.quantity_available, fields.min_order_quantity);
  const needsAttention =
    fields.status !== "archived" &&
    (fields.moderation_status !== "approved" || (fields.status === "active" && stockState !== "ok"));
  return { ...fields, stockState, needsAttention };
}

export function listingMatchesView(listing: BusinessListing, view: ListingView): boolean {
  switch (view) {
    case "all":
      return listing.status !== "archived";
    case "live":
      return listing.status === "active";
    case "drafts":
      return listing.status === "draft" || listing.status === "out_of_stock";
    case "attention":
      return listing.needsAttention;
    case "archived":
      return listing.status === "archived";
  }
}

export function countListings(listings: BusinessListing[]): ListingCounts {
  const counts: ListingCounts = { all: 0, live: 0, drafts: 0, attention: 0, archived: 0 };
  for (const listing of listings) {
    for (const view of LISTING_VIEWS) {
      if (listingMatchesView(listing, view)) counts[view] += 1;
    }
  }
  return counts;
}

/** `listings` must already be ordered by most recently updated. */
export function filterAndSortListings(
  listings: BusinessListing[],
  { view, query, sort }: { view: ListingView; query: string; sort: ListingSort }
): BusinessListing[] {
  const needle = query.trim().toLowerCase();
  const filtered = listings.filter(
    (listing) =>
      listingMatchesView(listing, view) &&
      (!needle ||
        listing.name.toLowerCase().includes(needle) ||
        (listing.category?.name.toLowerCase().includes(needle) ?? false))
  );

  const byName = (a: BusinessListing, b: BusinessListing) => a.name.localeCompare(b.name);
  switch (sort) {
    case "name":
      return filtered.sort(byName);
    case "price_asc":
      return filtered.sort((a, b) => a.price_per_unit - b.price_per_unit || byName(a, b));
    case "price_desc":
      return filtered.sort((a, b) => b.price_per_unit - a.price_per_unit || byName(a, b));
    case "stock_asc":
      return filtered.sort(
        (a, b) =>
          STOCK_STATE_PRIORITY[a.stockState] - STOCK_STATE_PRIORITY[b.stockState] ||
          a.quantity_available - b.quantity_available ||
          byName(a, b)
      );
    case "updated":
      return filtered;
  }
}
