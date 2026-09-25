import Link from "next/link";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface ProductPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount?: number;
  basePath?: string;
  searchParams?: {
    q?: string;
    category?: string;
    sort?: string;
    in_stock?: string;
  };
  className?: string;
}

/**
 * Generates an array of page numbers and ellipsis tokens for pagination navigation.
 */
function getPageRange(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
}

export function ProductPagination({
  currentPage,
  totalPages,
  totalCount,
  basePath = "/products",
  searchParams,
  className,
}: ProductPaginationProps) {
  // Hide pagination if there is only 1 page or invalid count
  if (totalPages <= 1) {
    return null;
  }

  const buildPageHref = (pageNumber: number) => {
    const params = new URLSearchParams();
    if (searchParams?.q) params.set("q", searchParams.q);
    if (searchParams?.category) params.set("category", searchParams.category);
    if (
      searchParams?.sort &&
      searchParams.sort !== "newest" &&
      (searchParams.sort !== "relevance" || !searchParams.q)
    ) {
      params.set("sort", searchParams.sort);
    }
    if (searchParams?.in_stock === "false") params.set("in_stock", "false");
    // Page 1 omits the page query parameter for clean canonical URLs
    if (pageNumber > 1) params.set("page", pageNumber.toString());

    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  const pages = getPageRange(currentPage, totalPages);
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <div
      className={cn("flex flex-col items-center gap-3 pt-6 pb-2", className)}
      data-slot="marketplace-pagination"
    >
      {/* Total count summary if provided */}
      {totalCount !== undefined && totalCount > 0 && (
        <p className="text-xs text-muted-foreground hidden sm:block">
          Page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
          <span className="font-semibold text-foreground">{totalPages}</span> ·{" "}
          <span className="font-medium text-foreground">{totalCount}</span> total listings
        </p>
      )}

      {/* ─── Compact Mobile Pagination (< 640px) ─── */}
      <div className="flex sm:hidden items-center justify-between w-full max-w-xs px-2 gap-2">
        <Link
          href={!isFirstPage ? buildPageHref(currentPage - 1) : "#"}
          aria-disabled={isFirstPage}
          tabIndex={isFirstPage ? -1 : undefined}
          className={cn(
            "inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs transition-colors hover:bg-muted/50",
            isFirstPage && "pointer-events-none opacity-40 cursor-not-allowed"
          )}
        >
          Previous
        </Link>

        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {currentPage} / {totalPages}
        </span>

        <Link
          href={!isLastPage ? buildPageHref(currentPage + 1) : "#"}
          aria-disabled={isLastPage}
          tabIndex={isLastPage ? -1 : undefined}
          className={cn(
            "inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs transition-colors hover:bg-muted/50",
            isLastPage && "pointer-events-none opacity-40 cursor-not-allowed"
          )}
        >
          Next
        </Link>
      </div>

      {/* ─── Standard shadcn Pagination (>= 640px) ─── */}
      <div className="hidden sm:flex">
        <Pagination>
          <PaginationContent>
            {/* Previous Page Link */}
            <PaginationItem>
              <PaginationPrevious
                href={!isFirstPage ? buildPageHref(currentPage - 1) : undefined}
                aria-disabled={isFirstPage}
                className={cn(
                  isFirstPage && "pointer-events-none opacity-40 cursor-not-allowed"
                )}
              />
            </PaginationItem>

            {/* Page Number Links */}
            {pages.map((p, idx) =>
              p === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={`page-${p}`}>
                  <PaginationLink
                    href={buildPageHref(p)}
                    isActive={p === currentPage}
                    className="cursor-pointer"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            {/* Next Page Link */}
            <PaginationItem>
              <PaginationNext
                href={!isLastPage ? buildPageHref(currentPage + 1) : undefined}
                aria-disabled={isLastPage}
                className={cn(
                  isLastPage && "pointer-events-none opacity-40 cursor-not-allowed"
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
