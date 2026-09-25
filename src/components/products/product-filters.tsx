"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiSearchLine, RiFilter3Line, RiCloseCircleLine, RiLoader4Line } from "@remixicon/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductSort } from "@/lib/supabase/queries/products";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useProductSearchOptional } from "@/components/products/product-search-context";

interface ProductFiltersProps {
  basePath: "/products" | "/business/products";
  variant?: "marketplace" | "business";
  initialSearch?: string;
  initialCategory?: string;
  categories?: Category[];
  initialSort?: ProductSort;
  initialInStockOnly?: boolean;
}

const SORT_LABELS: Record<ProductSort, string> = {
  relevance: "Most Relevant",
  newest: "Newest Added",
  harvest_newest: "Freshest Harvest",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  name_asc: "Name: A to Z",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  true: "In Stock Only",
  false: "All Availability",
};

export function ProductFilters({
  basePath,
  variant = "marketplace",
  initialSearch = "",
  initialCategory = "",
  categories = [],
  initialSort = "newest",
  initialInStockOnly = true,
}: ProductFiltersProps) {
  const router = useRouter();
  const searchContext = useProductSearchOptional();

  // Local state initialized with current active props
  const [draftSearch, setDraftSearch] = useState(
    searchContext?.searchQuery !== undefined ? searchContext.searchQuery : initialSearch
  );
  const [draftSort, setDraftSort] = useState<ProductSort>(initialSort);
  const [draftInStock, setDraftInStock] = useState<string>(
    initialInStockOnly ? "true" : "false"
  );
  const [draftCategory, setDraftCategory] = useState<string>(initialCategory);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Adjust state during render when props change
  const [prevProps, setPrevProps] = useState({
    initialSearch,
    initialSort,
    initialInStockOnly,
    initialCategory,
  });

  if (
    (prevProps.initialSearch !== initialSearch && !searchContext) ||
    prevProps.initialSort !== initialSort ||
    prevProps.initialInStockOnly !== initialInStockOnly ||
    prevProps.initialCategory !== initialCategory
  ) {
    setPrevProps({
      initialSearch,
      initialSort,
      initialInStockOnly,
      initialCategory,
    });
    if (!searchContext) {
      setDraftSearch(initialSearch);
    }
    setDraftSort(initialSort);
    setDraftInStock(initialInStockOnly ? "true" : "false");
    setDraftCategory(initialCategory);
  }

  // Calculate active filter count for the badge (sort, availability, category)
  let activeFilterCount = 0;
  if (initialSort && initialSort !== "newest") activeFilterCount++;
  if (initialInStockOnly === false) activeFilterCount++;
  if (initialCategory) activeFilterCount++;

  const handleApply = (overrides?: {
    search?: string;
    sort?: ProductSort;
    inStock?: string;
    category?: string;
  }) => {
    const qVal = overrides?.search !== undefined ? overrides.search : draftSearch;
    let sortVal = overrides?.sort !== undefined ? overrides.sort : draftSort;
    const inStockVal = overrides?.inStock !== undefined ? overrides.inStock : draftInStock;
    const catVal = overrides?.category !== undefined ? overrides.category : draftCategory;

    // If search is cleared or empty, reset relevance sort to newest
    if (!qVal?.trim() && sortVal === "relevance") {
      sortVal = "newest";
      setDraftSort("newest");
    }

    const params = new URLSearchParams();
    if (qVal && qVal.trim()) {
      params.set("q", qVal.trim());
    }
    if (catVal && catVal !== "all" && catVal.trim()) {
      params.set("category", catVal.trim());
    }
    if (sortVal && sortVal !== "newest") {
      params.set("sort", sortVal);
    }
    if (inStockVal === "false") {
      params.set("in_stock", "false");
    }

    setSheetOpen(false);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  const handleClearAll = () => {
    setDraftSearch("");
    setDraftSort("newest");
    setDraftInStock("true");
    setDraftCategory("");
    setSheetOpen(false);
    if (searchContext) {
      searchContext.clearSearch();
    }
    router.push(basePath);
  };

  return (
    <div className="w-full">
      {/* ─── Desktop & Tablet Layout (>= sm) ─── */}
      <div className="hidden sm:flex items-center gap-3 w-full">
        <div className={cn("relative flex-1", variant === "business" && "max-w-sm")}>
          {searchContext?.isSearching ? (
            <RiLoader4Line className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-primary animate-spin pointer-events-none" />
          ) : (
            <RiSearchLine className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          )}
          <Input
            value={draftSearch}
            onChange={(e) => {
              const val = e.target.value;
              setDraftSearch(val);
              if (searchContext) {
                searchContext.setSearchQuery(val);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply({ search: draftSearch });
              }
            }}
            placeholder={
              variant === "marketplace"
                ? "Search produce, varieties, or farm names…"
                : "Search products or farmers…"
            }
            className={cn(
              "pl-10 pr-9 bg-background text-sm shadow-xs",
              variant === "marketplace" ? "h-11" : "h-9"
            )}
            aria-label="Search produce"
          />
          {draftSearch && (
            <button
              type="button"
              onClick={() => {
                setDraftSearch("");
                const nextSort = draftSort === "relevance" ? "newest" : draftSort;
                if (draftSort === "relevance") setDraftSort("newest");
                if (searchContext) {
                  searchContext.clearSearch();
                } else {
                  handleApply({ search: "", sort: nextSort });
                }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-0.5 rounded-sm"
              aria-label="Clear search text"
            >
              <RiCloseCircleLine className="size-4" />
            </button>
          )}
        </div>

        <div
          className={cn(
            "flex items-center gap-2.5",
            variant === "business" && "gap-2"
          )}
        >
          {/* shadcn Select for Sort */}
          <Select
            value={draftSort}
            onValueChange={(val) => {
              if (val) setDraftSort(val as ProductSort);
            }}
          >
            <SelectTrigger
              className={cn(
                "rounded-md border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring text-foreground cursor-pointer shadow-xs",
                variant === "marketplace"
                  ? "h-11 min-w-[160px]"
                  : "h-9 min-w-[150px] text-xs shadow-sm"
              )}
              aria-label="Sort produce by"
            >
              <SelectValue placeholder="Sort produce by">
                {(val: string | null) =>
                  val && SORT_LABELS[val as ProductSort]
                    ? SORT_LABELS[val as ProductSort]
                    : "Newest Added"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {draftSearch.trim() && (
                <SelectItem value="relevance">Most Relevant</SelectItem>
              )}
              <SelectItem value="newest">Newest Added</SelectItem>
              <SelectItem value="harvest_newest">Freshest Harvest</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
              <SelectItem value="name_asc">Name: A to Z</SelectItem>
            </SelectContent>
          </Select>

          {/* shadcn Select for Availability */}
          <Select
            value={draftInStock}
            onValueChange={(val) => {
              if (val) setDraftInStock(val);
            }}
          >
            <SelectTrigger
              className={cn(
                "rounded-md border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring text-foreground cursor-pointer shadow-xs",
                variant === "marketplace"
                  ? "h-11 min-w-[150px]"
                  : "h-9 min-w-[140px] text-xs shadow-sm"
              )}
              aria-label="Filter availability"
            >
              <SelectValue placeholder="Filter availability">
                {(val: string | null) =>
                  val && AVAILABILITY_LABELS[val]
                    ? AVAILABILITY_LABELS[val]
                    : "In Stock Only"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">In Stock Only</SelectItem>
              <SelectItem value="false">All Availability</SelectItem>
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={() => handleApply()}
            className={cn(
              "cursor-pointer transition-colors shadow-xs rounded-md font-semibold",
              variant === "marketplace"
                ? "h-11 px-5 bg-primary text-sm text-primary-foreground hover:bg-primary/90"
                : "h-9 px-3 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
            )}
          >
            Apply
          </button>
        </div>
      </div>

      {/* ─── Small Mobile Layout (< sm) ─── */}
      <div className="flex sm:hidden items-center gap-2 w-full">
        {/* Immediately visible Search input */}
        <div className="relative flex-1 min-w-0">
          {searchContext?.isSearching ? (
            <RiLoader4Line className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary animate-spin pointer-events-none" />
          ) : (
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          )}
          <Input
            value={draftSearch}
            onChange={(e) => {
              const val = e.target.value;
              setDraftSearch(val);
              if (searchContext) {
                searchContext.setSearchQuery(val);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply({ search: draftSearch });
              }
            }}
            placeholder={
              variant === "marketplace"
                ? "Search produce…"
                : "Search products…"
            }
            className="pl-9 pr-8 h-10 bg-background text-sm shadow-xs w-full"
            aria-label="Search produce"
          />
          {draftSearch && (
            <button
              type="button"
              onClick={() => {
                setDraftSearch("");
                const nextSort = draftSort === "relevance" ? "newest" : draftSort;
                if (draftSort === "relevance") setDraftSort("newest");
                if (searchContext) {
                  searchContext.clearSearch();
                } else {
                  handleApply({ search: "", sort: nextSort });
                }
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-0.5 rounded-sm"
              aria-label="Clear search text"
            >
              <RiCloseCircleLine className="size-4" />
            </button>
          )}
        </div>

        {/* Compact Filter Trigger button */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={cn(
            "h-10 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors shadow-xs cursor-pointer shrink-0 bg-background hover:bg-muted/50",
            activeFilterCount > 0
              ? "border-primary text-primary font-semibold bg-primary/5"
              : "border-input text-foreground"
          )}
          aria-label="Open product filters"
        >
          <RiFilter3Line className="size-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ─── shadcn Mobile Filter Sheet (< sm) ─── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-[300px] sm:w-[360px] p-0 flex flex-col justify-between"
        >
          {/* Header */}
          <div className="p-5 border-b border-border/60">
            <SheetHeader>
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg font-bold text-foreground">
                  Filters
                </SheetTitle>
              </div>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                Refine produce by sort, availability, and category.
              </SheetDescription>
            </SheetHeader>
          </div>

          {/* Body Form Controls */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* shadcn Select for Sort */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="mobile-filter-sort"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Sort
              </label>
              <Select
                value={draftSort}
                onValueChange={(val) => {
                  if (val) setDraftSort(val as ProductSort);
                }}
              >
                <SelectTrigger
                  id="mobile-filter-sort"
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <SelectValue placeholder="Sort produce by">
                    {(val: string | null) =>
                      val && SORT_LABELS[val as ProductSort]
                        ? SORT_LABELS[val as ProductSort]
                        : "Newest Added"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {draftSearch.trim() && (
                    <SelectItem value="relevance">Most Relevant</SelectItem>
                  )}
                  <SelectItem value="newest">Newest Added</SelectItem>
                  <SelectItem value="harvest_newest">Freshest Harvest</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  <SelectItem value="name_asc">Name: A to Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* shadcn Select for Availability */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="mobile-filter-availability"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Availability
              </label>
              <Select
                value={draftInStock}
                onValueChange={(val) => {
                  if (val) setDraftInStock(val);
                }}
              >
                <SelectTrigger
                  id="mobile-filter-availability"
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <SelectValue placeholder="Filter availability">
                    {(val: string | null) =>
                      val && AVAILABILITY_LABELS[val]
                        ? AVAILABILITY_LABELS[val]
                        : "In Stock Only"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  <SelectItem value="true">In Stock Only</SelectItem>
                  <SelectItem value="false">All Availability</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* shadcn Select for Category */}
            {categories.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="mobile-filter-category"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Category
                </label>
                <Select
                  value={draftCategory || "all"}
                  onValueChange={(val) => {
                    setDraftCategory(!val || val === "all" ? "" : val);
                  }}
                >
                  <SelectTrigger
                    id="mobile-filter-category"
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                  >
                    <SelectValue placeholder="All Categories">
                      {(val: string | null) => {
                        if (!val || val === "all") {
                          return variant === "marketplace"
                            ? "All Produce"
                            : "All Categories";
                        }
                        const found = categories.find((c) => c.slug === val);
                        return found ? found.name : val;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    <SelectItem value="all">
                      {variant === "marketplace" ? "All Produce" : "All Categories"}
                    </SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-border p-5 flex flex-col gap-2.5 bg-muted/20">
            <Button
              type="button"
              onClick={() => handleApply()}
              className="w-full h-11 bg-primary text-primary-foreground font-semibold text-sm rounded-md shadow-xs transition-colors hover:bg-primary/90"
            >
              Apply filters
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearAll}
              className="w-full h-10 border border-input text-muted-foreground hover:text-foreground font-medium text-sm rounded-md transition-colors"
            >
              Clear all
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
