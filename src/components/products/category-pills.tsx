import Link from "next/link";
import { RiPlantLine } from "@remixicon/react";
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

  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar",
        className
      )}
      role="navigation"
      aria-label="Filter by produce category"
    >
      <Link
        href={buildCategoryHref()}
        aria-current={!activeCategory ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border shadow-2xs",
          !activeCategory
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
        )}
      >
        <RiPlantLine className="size-3.5 shrink-0" />
        <span>{allLabel}</span>
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.slug}
          href={buildCategoryHref(cat.slug)}
          aria-current={activeCategory === cat.slug ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border shadow-2xs",
            activeCategory === cat.slug
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
          )}
        >
          <CategoryIcon slug={cat.slug} className="size-3.5 shrink-0" />
          <span>{cat.name}</span>
        </Link>
      ))}
    </div>
  );
}
