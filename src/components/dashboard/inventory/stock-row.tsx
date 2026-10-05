import { ProductImage } from "@/components/ui/product-image";
import { ProductStatusBadge } from "@/components/dashboard/product-status-badge";
import { StockStateBadge } from "@/components/dashboard/inventory/stock-state-badge";
import { InventoryAdjustmentDialog } from "@/components/dashboard/inventory/inventory-adjustment-dialog";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { formatQuantity, type StockState } from "@/lib/inventory";
import type { BusinessListing } from "@/lib/listings";

/** Plain-language reason a listing needs stock, derived from the checkout rules. */
export function describeStockState(listing: BusinessListing): string | null {
  const moq = `${formatQuantity(listing.min_order_quantity)} ${listing.unit}`;
  const live = listing.status === "active";
  const messages: Record<Exclude<StockState, "ok">, string> = {
    out: live ? "Buyers can't order this listing until you add stock." : "No stock on hand.",
    below_moq: live
      ? `Buyers can't order: stock is below the ${moq} minimum order.`
      : `Stock is below the ${moq} minimum order.`,
    low: "Running low — consider restocking soon.",
  };
  return listing.stockState === "ok" ? null : messages[listing.stockState];
}

export function StockRow({ listing, emphasize = false }: { listing: BusinessListing; emphasize?: boolean }) {
  const reason = describeStockState(listing);

  return (
    <li
      // The full stock list is the anchor target (/dashboard/inventory#stock-{id}).
      id={emphasize ? undefined : `stock-${listing.id}`}
      data-testid={emphasize ? "attention-row" : "stock-row"}
      data-listing-id={listing.id}
      data-stock-state={listing.stockState}
      className="flex scroll-mt-24 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          <ProductImage src={getProductImageUrl(listing.image_path, listing.image_url)} alt="" sizes="44px" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground" data-testid="stock-row-name">
              {listing.name}
            </p>
            {listing.status !== "active" && <ProductStatusBadge status={listing.status} />}
            {listing.stockState !== "ok" && <StockStateBadge state={listing.stockState} />}
          </div>
          {reason && emphasize ? (
            <p className="text-xs text-muted-foreground">{reason}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Min. order {formatQuantity(listing.min_order_quantity)} {listing.unit}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <p className="text-right">
          <span className="sr-only">On hand: </span>
          <span
            className="text-lg font-semibold tabular-nums text-foreground"
            data-testid="stock-row-quantity"
          >
            {formatQuantity(listing.quantity_available)}
          </span>{" "}
          <span className="text-sm text-muted-foreground">{listing.unit}</span>
        </p>
        <InventoryAdjustmentDialog
          productId={listing.id}
          name={listing.name}
          unit={listing.unit}
          quantityAvailable={listing.quantity_available}
          triggerVariant={emphasize ? "default" : "outline"}
        />
      </div>
    </li>
  );
}
