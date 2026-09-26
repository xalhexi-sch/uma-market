import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ProductFilters } from "@/components/products/product-filters";
import { CategoryPills } from "@/components/products/category-pills";
import { ProductSearchProvider } from "@/components/products/product-search-context";
import { LiveProductGrid } from "@/components/products/live-product-grid";
import { getActiveProducts, getCategories } from "@/lib/supabase/queries/products";
import type { ProductSort } from "@/lib/supabase/queries/products";
import type { UserRole } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Products",
  description: "Find fresh local produce available for your business.",
};

// Re-render on every request so search params work
export const dynamic = "force-dynamic";

const VALID_SORTS: ProductSort[] = ["relevance", "newest", "harvest_newest", "price_asc", "price_desc", "name_asc"];

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; in_stock?: string }>;
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
  const inStockOnly = in_stock !== "false";
  const activeSort: ProductSort = VALID_SORTS.includes(sort as ProductSort)
    ? (sort as ProductSort)
    : q
    ? "relevance"
    : "newest";

  const [categories, initialProducts] = await Promise.all([
    getCategories(),
    getActiveProducts({
      search: q,
      categorySlug: category,
      sort: activeSort,
      inStockOnly: inStockOnly,
      limit: 48,
    }),
  ]);

  const selectedCategory = categories.find((c) => c.slug === category);

  return (
    <ProductSearchProvider
      basePath="/business/products"
      variant="business"
      initialSearch={q || ""}
      initialCategory={category || ""}
      initialSort={activeSort}
      initialInStockOnly={inStockOnly}
    >
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

          {/* Shared Horizontal Category Pill Bar */}
          <CategoryPills
            basePath="/business/products"
            categories={categories}
            activeCategory={category}
            allLabel="All Categories"
            searchParams={{ q, sort, in_stock }}
          />
        </div>

        {/* Live Product grid */}
        <LiveProductGrid
          variant="business"
          initialProducts={initialProducts}
          initialSearch={q}
          initialCategory={category}
          categoryName={selectedCategory?.name}
          inStockOnly={inStockOnly}
        />
      </div>
    </ProductSearchProvider>
  );
}
