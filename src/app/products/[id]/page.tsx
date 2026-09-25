import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  RiArrowLeftLine,
  RiMapPinLine,
  RiTruckLine,
  RiStore2Line,
  RiCalendarEventLine,
  RiShieldCheckLine,
  RiInformationLine,
  RiArrowRightLine,
} from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { AddToCartControls } from "@/components/dashboard/add-to-cart-controls";
import { ProductGallery } from "@/components/marketplace/product-gallery";
import { getProductById } from "@/lib/supabase/queries/products";
import { CURRENCY } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id).catch(() => null);
  if (!product) return { title: "Produce Not Found" };

  return {
    title: `${product.name} — Butuan Produce Marketplace`,
    description:
      product.description ||
      `Source fresh ${product.name} directly from local producers in Butuan City.`,
  };
}

export default async function PublicProductDetailPage({ params }: PageProps) {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  const { id } = await params;
  const product = await getProductById(id);

  // Only active products are accessible on public marketplace
  if (!product || product.status !== "active") {
    notFound();
  }

  const farmerName =
    product.farmer?.business_name ||
    product.farmer?.full_name ||
    "Local Producer";

  const isAvailable = product.quantity_available > 0;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Shared Minimal Public Header */}
      <MarketplaceHeader activeRoute="products" />

      <main className="flex-1">
        {/* Navigation Breadcrumb */}
        <div className="border-b border-border/60 bg-muted/20">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link href="/products" className="hover:text-foreground transition-colors">
                Products
              </Link>
              {product.category && (
                <>
                  <span>/</span>
                  <Link
                    href={`/products?category=${product.category.slug}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {product.category.name}
                  </Link>
                </>
              )}
              <span>/</span>
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {product.name}
              </span>
            </div>

            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <RiArrowLeftLine className="size-3.5" />
              <span>Back to Marketplace</span>
            </Link>
          </div>
        </div>

        {/* Product Details Section */}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column: Produce Imagery & Guarantee */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <ProductGallery
                images={product.images}
                productName={product.name}
                fallbackImagePath={product.image_path}
                fallbackImageUrl={product.image_url}
                categoryName={product.category?.name}
              />

              {/* Provenance Card */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Producer Provenance
                  </span>
                  {product.farmer?.is_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      ✓ Verified Producer
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <RiStore2Line className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{farmerName}</p>
                      {product.farmer?.city && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <RiMapPinLine className="size-3" />
                          {product.farmer.city}, Philippines
                        </p>
                      )}
                    </div>
                  </div>

                  {product.farmer?.bio && (
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed pl-12">
                      &ldquo;{product.farmer.bio}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Pricing, Attributes & Purchasing */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* Product Identity */}
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {product.name}
                </h1>

                {/* Price Display — NEVER HIDDEN */}
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-foreground">
                    {CURRENCY}
                    {product.price_per_unit.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  <span className="text-base font-normal text-muted-foreground">
                    per {product.unit}
                  </span>
                  <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Farm-Gate Price
                  </span>
                </div>
              </div>

              {/* Availability Indicator */}
              <div className="flex items-center gap-3">
                {isAvailable ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    <span>In Stock · {product.quantity_available} {product.unit} available</span>
                  </div>
                ) : (
                  <Badge variant="secondary" className="px-3 py-1 text-xs">
                    Out of Stock
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Key Harvest Specifications */}
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground block">
                    Available Supply
                  </span>
                  <span className="mt-0.5 font-semibold text-foreground">
                    {product.quantity_available} {product.unit}
                  </span>
                </div>

                <div>
                  <span className="text-xs font-medium text-muted-foreground block">
                    Minimum Order
                  </span>
                  <span className="mt-0.5 font-semibold text-foreground">
                    {product.min_order_quantity != null && product.min_order_quantity > 0
                      ? `${product.min_order_quantity} ${product.unit}`
                      : "No minimum"}
                  </span>
                </div>

                {product.harvest_date && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <RiCalendarEventLine className="size-3" />
                      Harvest Date
                    </span>
                    <span className="mt-0.5 font-semibold text-foreground">
                      {new Date(product.harvest_date).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}

                {product.available_until && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground block">
                      Available Until
                    </span>
                    <span className="mt-0.5 font-semibold text-foreground">
                      {new Date(product.available_until).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Product Description */}
              {product.description && (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Produce Description
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Fulfillment Options */}
              <div className="rounded-xl border border-border/80 bg-card p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Wholesale Fulfillment Options
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/30">
                    <RiStore2Line className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground block">Farm Pickup</span>
                      <span className="text-muted-foreground">
                        Collect directly from the producer&apos;s site in Butuan City.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/30">
                    <RiTruckLine className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground block">Seller Delivery</span>
                      <span className="text-muted-foreground">
                        Direct commercial drop-off to your registered business location.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ROLE-AWARE PURCHASING & CALL TO ACTION */}
              <div className="pt-2">
                {role === "business" ? (
                  // Business User: Full Ordering Flow
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Commercial Buyer Order
                      </span>
                      <Link
                        href="/business/cart"
                        className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <span>View Cart</span>
                        <RiArrowRightLine className="size-3.5" />
                      </Link>
                    </div>
                    <AddToCartControls product={product} />
                  </div>
                ) : role === "farmer" ? (
                  // Farmer User: Informational Only
                  <div className="rounded-xl border border-border bg-muted/30 p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <RiInformationLine className="size-4" />
                      <span>Farmer View</span>
                    </div>
                    <p className="text-sm text-foreground font-medium">
                      You are signed in with a Farmer account.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Wholesale purchasing is reserved for registered commercial business buyers.
                      You can manage your own harvest inventory and view incoming orders in your
                      farmer dashboard.
                    </p>
                    <div className="pt-1">
                      <Link
                        href="/farmer/products"
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                      >
                        Manage My Products
                      </Link>
                    </div>
                  </div>
                ) : role === "admin" ? (
                  // Admin User: Direct Moderation Shortcut
                  <div className="rounded-xl border border-border bg-muted/30 p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                      <RiShieldCheckLine className="size-4" />
                      <span>Platform Administrator</span>
                    </div>
                    <p className="text-sm text-foreground font-medium">
                      Active Marketplace Produce Listing
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This listing is active and discoverable by commercial buyers. You can review,
                      moderate, or update producer verification from the admin panel.
                    </p>
                    <div className="pt-1">
                      <Link
                        href="/admin/products"
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
                      >
                        Open Admin Catalog
                      </Link>
                    </div>
                  </div>
                ) : (
                  // Visitor (Unauthenticated): Sign In to Order CTA
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-6 flex flex-col gap-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                        <RiStore2Line className="size-4" />
                        Commercial Procurement
                      </span>
                      <h3 className="mt-1 text-lg font-bold text-foreground">
                        Ready to source this produce?
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        Commercial wholesale ordering is available to verified business accounts.
                        Sign in to configure order quantities, view live subtotals, and arrange farm
                        fulfillment.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <Link
                        href={`/sign-in?redirect_url=/products/${product.id}`}
                        className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                      >
                        Sign in to Order
                      </Link>
                      <Link
                        href={`/sign-up?redirect_url=/products/${product.id}`}
                        className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
                      >
                        Create Business Account
                      </Link>
                    </div>

                    <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                      Are you a local producer in Butuan?{" "}
                      <Link href="/sign-up" className="text-primary hover:underline font-medium">
                        Sell your produce on UMA
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Shared Editorial Footer */}
      <MarketplaceFooter />
    </div>
  );
}
