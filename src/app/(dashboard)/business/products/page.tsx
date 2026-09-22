import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { RiSearchLine } from "@remixicon/react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/dashboard/product-card";
import { getActiveProducts, getCategories } from "@/lib/supabase/queries/products";
import type { UserRole } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Products",
  description: "Find fresh local produce available for your business.",
};

// Re-render on every request so search params work
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

async function ProductGrid({ q, category }: { q?: string; category?: string }) {
  const products = await getActiveProducts({ search: q, categorySlug: category });

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
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border overflow-hidden">
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
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

  const { q, category } = await searchParams;
  const categories = await getCategories();

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find fresh local produce available for your business.
        </p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search products or farmers…"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/business/products"
            className={`rounded-md px-3 py-1.5 text-sm transition-colors border ${
              !category
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/business/products?${q ? `q=${encodeURIComponent(q)}&` : ""}category=${cat.slug}`}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors border ${
                category === cat.slug
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </form>

      {/* Product grid */}
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid q={q} category={category} />
      </Suspense>
    </div>
  );
}
