import Link from "next/link";
import { RiPlantLine, RiCheckboxCircleFill } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { CURRENCY } from "@/lib/constants";
import { getProductImageUrl } from "@/lib/supabase/storage";
import type { Product } from "@/lib/types";

interface MarketplaceProductCardProps {
  product: Product;
  href?: string;
}

function AvailabilityBadge({ qty, unit }: { qty: number; unit: string }) {
  if (qty <= 0) return <Badge variant="secondary">Out of stock</Badge>;
  if (qty <= 10) {
    return (
      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
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

export function MarketplaceProductCard({ product, href }: MarketplaceProductCardProps) {
  const farmerName =
    product.farmer?.business_name ||
    product.farmer?.full_name ||
    "Local Farm";

  const imageUrl = getProductImageUrl(product.image_path, product.image_url);
  const targetHref = href || `/products/${product.id}`;

  return (
    <Link
      href={targetHref}
      className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all duration-200"
    >
      {/* Produce Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <RiPlantLine className="size-10 text-muted-foreground/30" />
          </div>
        )}
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

        <div>
          <AvailabilityBadge qty={product.quantity_available} unit={product.unit} />
        </div>

        <div className="mt-auto flex items-center gap-1.5 pt-2 border-t border-border/50 text-xs text-muted-foreground">
          <RiPlantLine className="size-3.5 text-primary shrink-0" />
          <span className="truncate">
            From {farmerName}
            {product.farmer?.city ? `, ${product.farmer.city}` : ""}
          </span>
          {product.farmer?.is_verified && (
            <span title="Verified Local Producer" className="inline-flex items-center">
              <RiCheckboxCircleFill className="size-3.5 text-emerald-600 shrink-0" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
