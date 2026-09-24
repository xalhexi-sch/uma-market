import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { RiSearchLine } from "@remixicon/react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/dashboard/product-card";
import { ProductFilters } from "@/components/products/product-filters";
import { getActiveProducts, getCategories } from "@/lib/supabase/queries/products";
import type { ProductSort } from "@/lib/supabase/queries/products";
import type { UserRole } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Products",
  description: "Find fresh local produce available for your business.",
};

// Re-render on every request so search params work
export const dynamic = "force-dynamic";

const VALID_SORTS: ProductSort[] = ["newest", "harvest_newest", "price_asc", "price_desc", "name_asc"];

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; in_stock?: string }>;
}

async function ProductGrid({
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
  });

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <RiSearchLine className="size-10 text-muted-foreground/40 mb-4" />
        <p className="font-medium text-foreground">No products found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try &ldquo;{q || "vegetables"}&rdquo;, a different category, or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          href={`/business/products/${product.id}`}
        />
      ))}
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default async function BusinessProductsPage({ searchParams }: PageProps) {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "business") {
    if (role === "farmer") redirect("/farmer");
    if (role === "admin") redirect("/admin");
    redirect("/onboarding");
  }

  const { q, category, sort, in_stock } = await searchParams;
  const categories = await getCategories();
  const inStockOnly = in_stock !== "false";
  const activeSort: ProductSort = VALID_SORTS.includes(sort as ProductSort)
    ? (sort as ProductSort)
    : "newest";

  const buildCategoryHref = (catSlug?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort && sort !== "newest") params.set("sort", sort);
    if (in_stock === "false") params.set("in_stock", "false");
    if (catSlug) params.set("category", catSlug);
    const str = params.toString();
    return `/business/products${str ? `?${str}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find fresh local produce available for your business.
        </p>
      </div>

      {/* Filters & Sorting */}
      <div className="flex flex-col gap-4">
        <ProductFilters
          basePath="/business/products"
          variant="business"
          initialSearch={q}
          initialCategory={category}
          categories={categories}
          initialSort={activeSort}
          initialInStockOnly={inStockOnly}
        />

        {/* Category Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={buildCategoryHref()}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors border ${
              !category
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            All Categories
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={buildCategoryHref(cat.slug)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors border ${
                category === cat.slug
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid q={q} category={category} sort={activeSort} inStockOnly={inStockOnly} />
      </Suspense>
    </div>
  );
}
