"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { RiSearchLine, RiCloseCircleLine } from "@remixicon/react";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketplaceProductCard } from "@/components/marketplace/marketplace-product-card";
import { useProductSearchOptional } from "@/components/products/product-search-context";
import { ProductPagination } from "@/components/products/product-pagination";
import type { Product } from "@/lib/types";

interface LiveProductGridProps {
  variant?: "marketplace" | "business";
  initialProducts: Product[];
  initialSearch?: string;
  initialCategory?: string;
  initialCuratedNode?: ReactNode;
  categoryName?: string;
  inStockOnly?: boolean;
  totalPages?: number;
  currentPage?: number;
  totalCount?: number;
  searchParams?: {
    q?: string;
    category?: string;
    sort?: string;
    in_stock?: string;
  };
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

export function LiveProductGrid({
  variant = "marketplace",
  initialProducts,
  initialSearch = "",
  initialCategory = "",
  initialCuratedNode,
  categoryName,
  inStockOnly = true,
  totalPages,
  currentPage,
  totalCount,
  searchParams,
}: LiveProductGridProps) {
  const searchContext = useProductSearchOptional();

  const isSearching = searchContext?.isSearching ?? false;
  const hasSearched = searchContext?.hasSearched ?? false;
  const currentQuery = searchContext ? searchContext.searchQuery : initialSearch;
  const activeProducts = hasSearched && searchContext?.liveProducts !== null
    ? (searchContext?.liveProducts ?? [])
    : initialProducts;

  // If user cleared search and we have an initial curated catalog view, restore it
  if (!currentQuery.trim() && !initialCategory && initialCuratedNode && !hasSearched) {
    return <>{initialCuratedNode}</>;
  }

  // Active search or filter header
  const headerTitle = categoryName
    ? categoryName
    : currentQuery.trim()
    ? "Search Results"
    : "All Products";

  const isPageOutOfRange =
    !hasSearched &&
    currentPage !== undefined &&
    totalPages !== undefined &&
    totalPages > 0 &&
    currentPage > totalPages;

  return (
    <div className="flex flex-col gap-6">
      {/* Dynamic Results Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {headerTitle}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSearching ? (
              <span className="inline-flex items-center gap-1.5 animate-pulse text-primary font-medium">
                Searching produce…
              </span>
            ) : currentQuery.trim() ? (
              <>
                Showing results for &ldquo;{currentQuery.trim()}&rdquo;
                {inStockOnly ? " · In stock only" : ""}
              </>
            ) : (
              <>
                Filtered produce catalog
                {inStockOnly ? " · In stock only" : ""}
              </>
            )}
          </p>
        </div>

        {currentQuery.trim() && (
          <button
            type="button"
            onClick={() => {
              if (searchContext) {
                searchContext.clearSearch();
              }
            }}
            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <RiCloseCircleLine className="size-3.5" />
            Clear search
          </button>
        )}
      </div>

      {/* Loading Skeleton during pending live search */}
      {isSearching ? (
        <ProductGridSkeleton count={8} />
      ) : isPageOutOfRange ? (
        /* Out-of-bounds Page State */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center bg-card">
          <RiSearchLine className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            Page {currentPage} of results does not exist
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            There {totalPages === 1 ? "is" : "are"} only {totalPages}{" "}
            {totalPages === 1 ? "page" : "pages"} of produce listings available.
          </p>
          <Link
            href={variant === "business" ? "/business/products" : "/products"}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            Return to page 1
          </Link>
        </div>
      ) : activeProducts.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center bg-card">
          <RiSearchLine className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            No produce matches your search
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            We couldn&apos;t find any active produce matching{" "}
            {currentQuery.trim() ? (
              <span className="font-medium text-foreground">&ldquo;{currentQuery.trim()}&rdquo;</span>
            ) : (
              "your filters"
            )}
            . Try adjusting your search terms or checking back later.
          </p>
          {currentQuery.trim() && (
            <button
              type="button"
              onClick={() => {
                if (searchContext) {
                  searchContext.clearSearch();
                }
              }}
              className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 border border-border cursor-pointer transition-colors"
            >
              <RiCloseCircleLine className="size-4" />
              Clear search
            </button>
          )}
        </div>
      ) : (
        /* Live Results Grid */
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalCount !== undefined && totalCount > 0 && !hasSearched ? (
                <>
                  Showing <span className="font-semibold text-foreground">{activeProducts.length}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalCount}</span>{" "}
                  {totalCount === 1 ? "product" : "products"}
                </>
              ) : (
                <>
                  Showing <span className="font-semibold text-foreground">{activeProducts.length}</span>{" "}
                  {activeProducts.length === 1 ? "product" : "products"}
                </>
              )}
            </p>
          </div>

          <div
            className={
              variant === "business"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            }
          >
            {activeProducts.map((product) => (
              <MarketplaceProductCard
                key={product.id}
                product={product}
                variant={variant === "business" ? "business" : "public"}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {!hasSearched && totalPages !== undefined && totalPages > 1 && currentPage !== undefined && (
            <ProductPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              basePath={variant === "business" ? "/business/products" : "/products"}
              searchParams={searchParams}
            />
          )}
        </div>
      )}
    </div>
  );
}
