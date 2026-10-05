import { ProductImage } from "@/components/ui/product-image";
import { ProductStatusBadge } from "@/components/dashboard/product-status-badge";
import { StockStateBadge } from "@/components/dashboard/inventory/stock-state-badge";
import { ModerationBadge } from "@/components/dashboard/listings/moderation-badge";
import { ListingRowActions } from "@/components/dashboard/listings/listing-row-actions";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { formatPesoExact } from "@/lib/overview-format";
import { formatQuantity } from "@/lib/inventory";
import type { BusinessListing } from "@/lib/listings";

/** Shared grid so the desktop header lines up with every row. */
export const LISTING_ROW_GRID =
  "md:grid-cols-[minmax(0,1fr)_9rem_10rem_11rem_auto] md:items-center md:gap-4";

export function ListingRowHeader() {
  return (
    <div
      aria-hidden="true"
      className={`hidden border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground md:grid ${LISTING_ROW_GRID}`}
    >
      <span>Listing</span>
      <span>Price</span>
      <span>Stock</span>
      <span>Status</span>
      <span className="sr-only">Actions</span>
    </div>
  );
}

export function ListingRow({ listing }: { listing: BusinessListing }) {
  return (
    <li
      data-testid="listing-row"
      data-listing-id={listing.id}
      className={`grid grid-cols-2 gap-x-4 gap-y-3 p-4 ${LISTING_ROW_GRID}`}
    >
      <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          <ProductImage
            src={getProductImageUrl(listing.image_path, listing.image_url)}
            alt=""
            sizes="48px"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground" data-testid="listing-name">
            {listing.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {listing.category?.name ?? "Uncategorized"}
          </p>
        </div>
      </div>

      <div className="min-w-0 text-sm">
        <span className="block text-xs text-muted-foreground md:sr-only">Price</span>
        <span className="font-medium tabular-nums text-foreground">{formatPesoExact(listing.price_per_unit)}</span>
        <span className="text-muted-foreground"> / {listing.unit}</span>
        <span className="block text-xs text-muted-foreground">
          Min. order {formatQuantity(listing.min_order_quantity)} {listing.unit}
        </span>
      </div>

      <div className="min-w-0 text-sm">
        <span className="block text-xs text-muted-foreground md:sr-only">Stock</span>
        <span className="font-medium tabular-nums text-foreground" data-testid="listing-stock">
          {formatQuantity(listing.quantity_available)} {listing.unit}
        </span>
        {listing.stockState !== "ok" && listing.status !== "archived" && (
          <span className="mt-1 block">
            <StockStateBadge state={listing.stockState} />
          </span>
        )}
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-1">
        <span className="sr-only">Status:</span>
        <ProductStatusBadge status={listing.status} />
        <ModerationBadge status={listing.moderation_status} />
      </div>

      <div className="col-span-2 flex justify-end md:col-span-1">
        <ListingRowActions
          productId={listing.id}
          name={listing.name}
          status={listing.status}
          moderationStatus={listing.moderation_status}
        />
      </div>
    </li>
  );
}
