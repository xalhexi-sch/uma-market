"use client";

import Link from "next/link";
import { RiPlantLine } from "@remixicon/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategoryPillsProps {
  basePath: "/products" | "/business/products" | string;
  categories: Category[];
  activeCategory?: string;
  allLabel?: string;
  searchParams?: {
    q?: string;
    sort?: string;
    in_stock?: string;
  };
  className?: string;
}

/**
 * Shared CategoryPills component adhering to UMA Market design system:
 * - Powered by shadcn ToggleGroup / ToggleGroupItem primitives
 * - Rounded-full capsule pills with horizontal ribbon scrolling
 * - Semantic category icon reinforcement
 * - Whitespace-nowrap for multi-word categories
 * - Preserves active search, sort, and stock parameters
 * - Resets pagination back to page 1 upon category change
 */
export function CategoryPills({
  basePath,
  categories,
  activeCategory = "",
  allLabel = "All Produce",
  searchParams,
  className,
}: CategoryPillsProps) {
  const buildCategoryHref = (catSlug?: string) => {
    const params = new URLSearchParams();
    if (searchParams?.q) params.set("q", searchParams.q);
    if (
      searchParams?.sort &&
      searchParams.sort !== "newest" &&
      (searchParams.sort !== "relevance" || !searchParams.q)
    ) {
      params.set("sort", searchParams.sort);
    }
    if (searchParams?.in_stock) params.set("in_stock", searchParams.in_stock);
    if (catSlug) params.set("category", catSlug);
    // Page is intentionally omitted to reset pagination to page 1
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  const selectedValue = activeCategory || "all";

  return (
    <div
      className={cn(
        "flex items-center overflow-x-auto pb-1 pt-1 no-scrollbar",
        className
      )}
      role="navigation"
      aria-label="Filter by produce category"
    >
      <ToggleGroup
        value={[selectedValue]}
        variant="outline"
        size="sm"
        spacing={2}
        className="w-max"
      >
        <ToggleGroupItem
          value="all"
          nativeButton={false}
          render={<Link href={buildCategoryHref()} />}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-semibold gap-1.5 shadow-2xs transition-colors",
            selectedValue === "all"
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
              : "text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          <RiPlantLine className="size-3.5 shrink-0" />
          <span>{allLabel}</span>
        </ToggleGroupItem>

        {categories.map((cat) => {
          const isSelected = selectedValue === cat.slug;
          return (
            <ToggleGroupItem
              key={cat.slug}
              value={cat.slug}
              nativeButton={false}
              render={<Link href={buildCategoryHref(cat.slug)} />}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold gap-1.5 shadow-2xs transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
                  : "text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              <CategoryIcon slug={cat.slug} className="size-3.5 shrink-0" />
              <span>{cat.name}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
