import Link from "next/link";
import { RiPlantLine, RiCheckboxCircleFill } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { CURRENCY } from "@/lib/constants";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { ProductImage } from "@/components/ui/product-image";
import type { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
  href?: string;
}

function AvailabilityBadge({ qty, unit }: { qty: number; unit: string }) {
  if (qty <= 0) return <Badge variant="secondary">Out of stock</Badge>;
  if (qty <= 10) return (
    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
      Only {qty} {unit} left
    </Badge>
  );
  return (
    <span className="text-sm text-muted-foreground">
      {qty} {unit} available
    </span>
  );
}

export function ProductCard({ product, href }: ProductCardProps) {
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
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        <ProductImage
          src={imageUrl}
          alt={product.name}
          className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />
        {product.category && (
          <span className="absolute top-2 left-2 rounded-md bg-background/90 backdrop-blur-sm px-2 py-0.5 text-[11px] font-medium text-foreground">
            {product.category.name}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <p className="mt-0.5 text-xl font-bold text-foreground">
            {CURRENCY}
            {product.price_per_unit.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              / {product.unit}
            </span>
          </p>
        </div>

        <AvailabilityBadge qty={product.quantity_available} unit={product.unit} />

        <div className="mt-auto flex items-center gap-1.5 pt-2 border-t border-border/60 text-xs text-foreground/80">
          <RiPlantLine className="size-3.5 text-primary shrink-0" />
          <span className="truncate font-medium">
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
