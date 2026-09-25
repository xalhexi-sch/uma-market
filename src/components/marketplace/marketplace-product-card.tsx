import Link from "next/link";
import { RiPlantLine, RiCheckboxCircleFill } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { CURRENCY } from "@/lib/constants";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { ProductImage } from "@/components/ui/product-image";
import type { Product } from "@/lib/types";

export interface MarketplaceProductCardProps {
  product: Product;
  href?: string;
  variant?: "public" | "business";
}

function AvailabilityBadge({ qty, unit }: { qty: number; unit: string }) {
  if (qty <= 0) {
    return (
      <Badge variant="secondary" className="text-xs px-2 py-0.5">
        Out of stock
      </Badge>
    );
  }
  if (qty <= 10) {
    return (
      <Badge
        variant="outline"
        className="text-xs font-medium text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 px-2 py-0.5"
      >
        Only {qty} {unit} left
      </Badge>
    );
  }
  return (
    <span className="text-xs font-medium text-muted-foreground">
      {qty} {unit} available
    </span>
  );
}

export function MarketplaceProductCard({
  product,
  href,
  variant = "public",
}: MarketplaceProductCardProps) {
  const farmerName =
    product.farmer?.business_name ||
    product.farmer?.full_name ||
    "Local Farm";

  const imageUrl = getProductImageUrl(product.image_path, product.image_url);
  const targetHref = href || (variant === "business" ? `/business/products/${product.id}` : `/products/${product.id}`);

  return (
    <Link
      href={targetHref}
      className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all duration-200"
    >
      {/* Produce Image (Locked to 4:3 Ratio) */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        <ProductImage
          src={imageUrl}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
        />
        {product.category && (
          <span className="absolute top-2 left-2 rounded-md bg-background/90 backdrop-blur-xs px-2 py-0.5 text-[11px] font-medium text-foreground shadow-xs">
            {product.category.name}
          </span>
        )}
      </div>

      {/* Scannable B2B Procurement Metadata */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1">
            {product.name}
          </h3>
          <p className="mt-1 text-lg font-bold text-foreground">
            {CURRENCY}
            {product.price_per_unit.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              / {product.unit}
            </span>
          </p>
        </div>

        {/* Availability & Wholesale Minimum Order Quantity (MOQ) */}
        <div className="flex items-center justify-between gap-2">
          <AvailabilityBadge qty={product.quantity_available} unit={product.unit} />
          {product.min_order_quantity != null && product.min_order_quantity > 0 && (
            <span
              title={`Minimum wholesale order: ${product.min_order_quantity} ${product.unit}`}
              className="inline-flex items-center text-[11px] font-medium text-muted-foreground/90 bg-muted/60 dark:bg-muted/40 rounded px-1.5 py-0.5 border border-border/50 shrink-0 tabular-nums"
            >
              MOQ: {product.min_order_quantity} {product.unit}
            </span>
          )}
        </div>

        {/* Producer Provenance & Location */}
        <div className="mt-auto flex items-center gap-1.5 pt-2.5 border-t border-border/60 text-xs text-foreground/80">
          <RiPlantLine className="size-3.5 text-primary shrink-0" />
          <span className="truncate font-medium flex-1">
            <span className="text-muted-foreground font-normal">From </span>
            <span className="text-foreground font-semibold">{farmerName}</span>
            {product.farmer?.city ? (
              <span className="text-muted-foreground font-normal">{`, ${product.farmer.city}`}</span>
            ) : (
              ""
            )}
          </span>
          {product.farmer?.is_verified && (
            <span title="Verified Local Producer" className="inline-flex items-center shrink-0">
              <RiCheckboxCircleFill className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// Canonical alias
export { MarketplaceProductCard as ProductCard };
