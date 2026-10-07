"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiSearchLine, RiFilter3Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { SearchAutocomplete } from "@/components/products/search-autocomplete";

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

  // Derive the active search value: when searchContext is active, it is the source of truth
  const activeSearchValue = searchContext ? searchContext.searchQuery : draftSearch;

  // Adjust state during render when props change
  const [prevProps, setPrevProps] = useState({
    initialSearch,
    initialSort,
    initialInStockOnly,
    initialCategory,
  });

  if (
    prevProps.initialSearch !== initialSearch ||
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
    setDraftSearch(initialSearch);
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
      {/* ─── Unified Responsive Search & Filter Bar ─── */}
      <div className="flex items-center gap-2 sm:gap-3 w-full">
        {/* Single responsive Search input with live autocomplete */}
        <SearchAutocomplete
          value={activeSearchValue}
          onChange={(val) => {
            setDraftSearch(val);
            if (searchContext) {
              searchContext.setSearchQuery(val);
            }
          }}
          onSubmit={(val) => {
            handleApply({ search: val });
          }}
          onClear={() => {
            setDraftSearch("");
            const nextSort = draftSort === "relevance" ? "newest" : draftSort;
            if (draftSort === "relevance") setDraftSort("newest");
            if (searchContext) {
              searchContext.clearSearch();
            } else {
              handleApply({ search: "", sort: nextSort });
            }
          }}
          basePath={basePath}
          variant={variant}
          isSearchingContext={searchContext?.isSearching}
          className={cn("flex-1 min-w-0", variant === "business" && "sm:max-w-sm")}
        />

        {/* Desktop Controls (>= sm) */}
        <div
          className={cn(
            "hidden sm:flex items-center gap-2.5",
            variant === "business" && "gap-2"
          )}
        >
          {/* shadcn Select for Sort — Auto-applies on change */}
          <Select
            value={draftSort}
            onValueChange={(val) => {
              if (val) {
                const sort = val as ProductSort;
                setDraftSort(sort);
                handleApply({ sort });
              }
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

          {/* shadcn Select for Availability — Auto-applies on change */}
          <Select
            value={draftInStock}
            onValueChange={(val) => {
              if (val) {
                setDraftInStock(val);
                handleApply({ inStock: val });
              }
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

          {/* Search submit button — replaces generic "Apply" since dropdowns now auto-apply */}
          <Button
            type="button"
            onClick={() => handleApply({ search: draftSearch })}
            variant={variant === "marketplace" ? "default" : "secondary"}
            className={cn(
              "cursor-pointer transition-colors shadow-xs font-semibold gap-1.5",
              variant === "marketplace"
                ? "h-11 px-4 text-sm"
                : "h-9 px-3 text-xs font-medium border border-border"
            )}
            aria-label="Search"
          >
            <RiSearchLine className="size-4" />
            <span className="hidden lg:inline">Search</span>
          </Button>
        </div>

        {/* Small Mobile Filter Trigger (< sm) */}
        <div className="flex sm:hidden shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSheetOpen(true)}
            className={cn(
              "h-10 px-3 gap-1.5 shrink-0 cursor-pointer shadow-xs",
              activeFilterCount > 0 &&
                "border-primary text-primary font-semibold bg-primary/5 hover:bg-primary/10"
            )}
            aria-label="Open product filters"
          >
            <RiFilter3Line className="size-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Badge className="size-4.5 p-0 justify-center rounded-full text-[10px] font-bold">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* ─── shadcn Mobile Filter Sheet (< sm) ─── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-[300px] sm:w-[360px] p-0 flex flex-col justify-between"
        >
          {/* Header */}
          <div className="p-5">
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
          <Separator />

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
          <Separator />
          <div className="p-5 flex flex-col gap-2.5 bg-muted/20">
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
