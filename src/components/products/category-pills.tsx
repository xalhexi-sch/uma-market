import Link from "next/link";
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
    if (searchParams?.in_stock === "false") params.set("in_stock", "false");
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
        className={cn(
          "rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border shadow-2xs",
          !activeCategory
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
        )}
      >
        {allLabel}
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.slug}
          href={buildCategoryHref(cat.slug)}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border shadow-2xs",
            activeCategory === cat.slug
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
          )}
        >
          {cat.name}
        </Link>
      ))}
    </div>
  );
}
