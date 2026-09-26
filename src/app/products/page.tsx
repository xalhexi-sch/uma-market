import type { Metadata } from "next";
import Link from "next/link";
import {
  RiPlantLine,
  RiArrowRightLine,
  RiCheckDoubleLine,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceProductCard } from "@/components/marketplace/marketplace-product-card";
import { ProductFilters } from "@/components/products/product-filters";
import { CategoryPills } from "@/components/products/category-pills";
import { ProductSearchProvider } from "@/components/products/product-search-context";
import { LiveProductGrid } from "@/components/products/live-product-grid";
import { getActiveProducts, searchActiveProducts, getCategories } from "@/lib/supabase/queries/products";
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
    page?: string;
  }>;
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
  // Run Available Now (in-stock) and complete catalog queries concurrently
  const [availableNow, allProducts] = await Promise.all([
    getActiveProducts({
      inStockOnly: true,
      sort: "newest",
      limit: 6,
    }),
    getActiveProducts({
      sort: "newest",
      limit: 24,
    }),
  ]);

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

export default async function ProductsMarketplacePage({ searchParams }: PageProps) {
  const { q, category, sort, in_stock, page } = await searchParams;

  const rawPage = parseInt(page || "1", 10);
  const currentPage = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  const isFiltering =
    !!q || !!category || in_stock === "false" || (!!sort && sort !== "newest" && sort !== "relevance");
  const inStockOnly = in_stock !== "false";
  const activeSort: ProductSort = VALID_SORTS.includes(sort as ProductSort)
    ? (sort as ProductSort)
    : q
    ? "relevance"
    : "newest";

  // Catalog browsing mode is active if filtering OR requesting page > 1
  const isCatalogMode = isFiltering || currentPage > 1;

  // Run independent category and catalog queries concurrently
  const [categories, searchResult] = await Promise.all([
    getCategories(),
    (async () => {
      if (!isCatalogMode) return null;
      return await searchActiveProducts({
        search: q,
        categorySlug: category,
        sort: activeSort,
        inStockOnly,
        page: currentPage,
        limit: 24,
      });
    })(),
  ]);

  const initialProducts = searchResult?.products ?? [];
  const totalCount = searchResult?.totalCount ?? 0;
  const totalPages = searchResult?.totalPages ?? 1;

  const selectedCategory = categories.find((c) => c.slug === category);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Shared Minimal Public Header */}
      <MarketplaceHeader activeRoute="products" />

      <main className="flex-1">
        <ProductSearchProvider
          basePath="/products"
          variant="marketplace"
          initialSearch={q || ""}
          initialCategory={category || ""}
          initialSort={activeSort}
          initialInStockOnly={inStockOnly}
        >
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

                {/* Shared Horizontal Category Pill Bar */}
                <CategoryPills
                  basePath="/products"
                  categories={categories}
                  activeCategory={category}
                  allLabel="All Produce"
                  searchParams={{ q, sort, in_stock }}
                />
              </div>
            </div>
          </section>

          {/* Content Area: Curated Discovery or Live Filtered Results */}
          <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
            <LiveProductGrid
              variant="marketplace"
              initialProducts={initialProducts}
              initialSearch={q}
              initialCategory={category}
              categoryName={selectedCategory?.name}
              inStockOnly={inStockOnly}
              initialCuratedNode={!isCatalogMode ? <CuratedDiscovery categories={categories} /> : null}
              totalPages={totalPages}
              currentPage={currentPage}
              totalCount={totalCount}
              searchParams={{ q, category, sort, in_stock }}
            />
          </section>
        </ProductSearchProvider>
      </main>

      {/* Shared Editorial Footer */}
      <MarketplaceFooter />
    </div>
  );
}
