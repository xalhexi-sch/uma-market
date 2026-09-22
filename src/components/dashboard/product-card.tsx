import Link from "next/link";
import { RiPlantLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { CURRENCY } from "@/lib/constants";
import type { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
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

export function ProductCard({ product }: ProductCardProps) {
  const farmerName =
    product.farmer?.business_name ||
    product.farmer?.full_name ||
    "Local Farm";

  return (
    <Link
      href={`/business/products/${product.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all duration-200"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <RiPlantLine className="size-10 text-muted-foreground/30" />
          </div>
        )}
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

        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <RiPlantLine className="size-3.5 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground truncate">
            From {farmerName}
            {product.farmer?.city ? `, ${product.farmer.city}` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
