import Link from "next/link";
import { RiArrowRightLine } from "@remixicon/react";
import { MarketplaceProductCard } from "@/components/marketplace/marketplace-product-card";
import { ProductRailCarousel } from "@/components/marketplace/product-rail-carousel";
import { getActiveProducts } from "@/lib/supabase/queries/products";

export async function FreshOnUmaRail() {
  const products = await getActiveProducts({
    inStockOnly: true,
    sort: "newest",
    limit: 6,
  });

  if (products.length === 0) return null;

  return (
    <section className="bg-background py-14 sm:py-18 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Fresh on UMA
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              What&apos;s available now
            </h2>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            Explore more produce
            <RiArrowRightLine className="size-4" />
          </Link>
        </div>

        {/* Horizontal product carousel */}
        <ProductRailCarousel itemCount={products.length}>
          {products.map((product) => (
            <MarketplaceProductCard key={product.id} product={product} />
          ))}
        </ProductRailCarousel>
      </div>
    </section>
  );
}
