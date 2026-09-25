import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  RiSearchLine,
  RiPlantLine,
  RiArrowRightLine,
  RiCheckDoubleLine,
  RiCloseCircleLine,
} from "@remixicon/react";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceProductCard } from "@/components/marketplace/marketplace-product-card";
import { ProductFilters } from "@/components/products/product-filters";
import { getActiveProducts, getCategories } from "@/lib/supabase/queries/products";
import type { ProductSort } from "@/lib/supabase/queries/products";
import type { Category } from "@/lib/types";

export const metadata: Metadata = {
  title: "Produce Marketplace",
  description:
    "Source fresh local produce directly from verified farmers in Butuan City. In-stock availability, direct farm-gate pricing, and transparent procurement.",
};

export const dynamic = "force-dynamic";

const VALID_SORTS: ProductSort[] = [
  "relevance",
  "newest",
  "harvest_newest",
  "price_asc",
  "price_desc",
  "name_asc",
];

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    in_stock?: string;
  }>;
}

function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4 bg-card">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// Category Discovery Cards Component
function CategoryDiscoverySection({ categories }: { categories: Category[] }) {
  return (
    <section className="py-2">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Browse by Category
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Find produce across {categories.length} dedicated categories.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/products?category=${cat.slug}`}
            className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-xs transition-all duration-200"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <RiPlantLine className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {cat.name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {cat.description || `Fresh ${cat.name.toLowerCase()} from Butuan producers.`}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary">
              <span>View produce</span>
              <RiArrowRightLine className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// Curated Discovery Sections with REAL database data
async function CuratedDiscovery({
  categories,
}: {
  categories: Category[];
}) {
  // 1. Available Now: In-stock active products — primary discovery section
  const availableNow = await getActiveProducts({
    inStockOnly: true,
    sort: "newest",
    limit: 6,
  });

  // 2. Complete catalog listing
  const allProducts = await getActiveProducts({
    sort: "newest",
    limit: 24,
  });

  return (
    <div className="flex flex-col gap-14 sm:gap-18">
      {/* 1. Available Now — Primary discovery section */}
      {availableNow.length > 0 && (
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <RiCheckDoubleLine className="size-4" />
                <span>In Stock</span>
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Available Now
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Produce currently in stock and ready for ordering.
              </p>
            </div>
            <Link
              href="/products?in_stock=true"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              See all in-stock produce
              <RiArrowRightLine className="size-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {availableNow.map((p) => (
              <MarketplaceProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* 2. Browse by Category */}
      <CategoryDiscoverySection categories={categories} />

      {/* 3. Complete Active Produce Catalog */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            All Produce Listings
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete catalog of active wholesale offerings.
          </p>
        </div>

        {allProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center bg-card">
            <RiPlantLine className="size-10 text-muted-foreground/40 mb-3" />
            <p className="font-semibold text-foreground">No active produce listed yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Farmers are preparing upcoming seasonal harvests. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allProducts.map((p) => (
              <MarketplaceProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Filtered Search Results View
async function FilteredResults({
  q,
  category,
  sort,
  inStockOnly,
}: {
  q?: string;
  category?: string;
  sort?: ProductSort;
  inStockOnly?: boolean;
}) {
  const products = await getActiveProducts({
    search: q,
    categorySlug: category,
    sort: sort || "newest",
    inStockOnly: inStockOnly ?? true,
    limit: 48,
  });

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center bg-card">
        <RiSearchLine className="size-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold text-foreground">No produce matches your search</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">
          We couldn&apos;t find any active produce matching{" "}
          {q ? <span className="font-medium text-foreground">&ldquo;{q}&rdquo;</span> : "your filters"}.
          Try adjusting your search terms or clearing category filters.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 border border-border"
        >
          <RiCloseCircleLine className="size-4" />
          Clear all filters
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{products.length}</span>{" "}
          {products.length === 1 ? "product" : "products"}
        </p>
        <Link
          href="/products"
          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          <RiCloseCircleLine className="size-3.5" />
          Reset filters
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <MarketplaceProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

export default async function ProductsMarketplacePage({ searchParams }: PageProps) {
  const { q, category, sort, in_stock } = await searchParams;
  const categories = await getCategories();

  const isFiltering =
    !!q || !!category || in_stock === "false" || (!!sort && sort !== "newest" && sort !== "relevance");
  const inStockOnly = in_stock !== "false";
  const activeSort: ProductSort = VALID_SORTS.includes(sort as ProductSort)
    ? (sort as ProductSort)
    : q
    ? "relevance"
    : "newest";

  const selectedCategory = categories.find((c) => c.slug === category);

  const buildCategoryHref = (catSlug?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort && sort !== "newest" && (sort !== "relevance" || !q)) params.set("sort", sort);
    if (in_stock === "false") params.set("in_stock", "false");
    if (catSlug) params.set("category", catSlug);
    const str = params.toString();
    return `/products${str ? `?${str}` : ""}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Shared Minimal Public Header */}
      <MarketplaceHeader activeRoute="products" />

      <main className="flex-1">
        {/* Marketplace Hero & Search Section */}
        <section className="border-b border-border/60 bg-muted/20 py-8 sm:py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Produce Marketplace
              </h1>
              <p className="mt-2 text-base text-muted-foreground">
                Find fresh produce from verified Butuan producers. Farm-gate pricing with clear availability.
              </p>
            </div>

            {/* Prominent Search & Filter Controls */}
            <div className="mt-8 flex flex-col gap-4">
              <ProductFilters
                basePath="/products"
                variant="marketplace"
                initialSearch={q}
                initialCategory={category}
                categories={categories}
                initialSort={activeSort}
                initialInStockOnly={inStockOnly}
              />

              {/* Horizontal Category Pill Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
                <Link
                  href={buildCategoryHref()}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border shadow-2xs ${
                    !category
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  All Produce
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={buildCategoryHref(cat.slug)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border shadow-2xs ${
                      category === cat.slug
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Content Area: Curated Discovery or Filtered Results */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
          {isFiltering ? (
            <div className="flex flex-col gap-6">
              {/* Active Filter Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {selectedCategory ? selectedCategory.name : "Search Results"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {q ? `Showing results for "${q}"` : "Filtered produce catalog"}
                    {inStockOnly ? " · In stock only" : ""}
                  </p>
                </div>
              </div>

              <Suspense fallback={<ProductGridSkeleton count={8} />}>
                <FilteredResults
                  q={q}
                  category={category}
                  sort={activeSort}
                  inStockOnly={inStockOnly}
                />
              </Suspense>
            </div>
          ) : (
            <Suspense fallback={<ProductGridSkeleton count={8} />}>
              <CuratedDiscovery categories={categories} />
            </Suspense>
          )}
        </section>
      </main>

      {/* Shared Editorial Footer */}
      <MarketplaceFooter />
    </div>
  );
}
