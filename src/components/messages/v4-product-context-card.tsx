import Link from "next/link";
import Image from "next/image";
import { RiShoppingBag3Line, RiExternalLinkLine } from "@remixicon/react";
import { formatCurrency } from "@/lib/utils";

interface V4ProductContextCardProps {
  product: {
    id: string;
    name: string;
    price_per_unit: number;
    unit: string;
    image_url?: string | null;
  };
}

export function V4ProductContextCard({ product }: V4ProductContextCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/95 p-2.5 text-xs shadow-2xs max-w-sm transition-colors hover:border-primary/50">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <RiShoppingBag3Line className="size-5 text-muted-foreground/60" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <span className="truncate">{product.name}</span>
        </div>
        <p className="text-muted-foreground mt-0.5">
          {formatCurrency(product.price_per_unit)} / {product.unit}
        </p>
      </div>

      <Link
        href={`/products/${product.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 flex items-center gap-1 font-medium text-primary hover:underline px-2 py-1 rounded hover:bg-primary/5"
      >
        <span>Listing</span>
        <RiExternalLinkLine className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
