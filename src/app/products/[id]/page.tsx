import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCalendarEventLine,
  RiCheckboxCircleFill,
  RiInformationLine,
  RiMapPinLine,
  RiShieldCheckLine,
  RiShoppingCart2Line,
  RiStore2Line,
} from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceProductCard } from "@/components/marketplace/marketplace-product-card";
import { AddToCartControls } from "@/components/dashboard/add-to-cart-controls";
import { ProductGallery } from "@/components/marketplace/product-gallery";
import { MessageProducerAction } from "@/components/products/message-producer-action";
import { getProductById } from "@/lib/supabase/queries/products";
import { getActiveProductsByFarmer } from "@/lib/supabase/queries/public-profiles";
import {
  getProductReviewSummary,
  getProductReviews,
  getSellerReviewSummary,
} from "@/lib/supabase/queries/reviews";
import { ReviewList } from "@/components/reviews/review-list";
import { ReviewSummary } from "@/components/reviews/review-summary";
import { CURRENCY } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import { routes } from "@/platform/routes";
import { serializeJsonLd } from "@/lib/json-ld";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

const LOW_STOCK_THRESHOLD = 10;

function formatPrice(value: number) {
  return `${CURRENCY}${value.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id).catch(() => null);
  if (!product) return { title: "Product Not Found — UMA Market" };

  const imageUrl = product.image_url || product.image_path || "";
  const title = `${product.name} — UMA Market`;
  const description =
    product.description ||
    `Source ${product.name} directly from local producers in Butuan City.`;

  return {
    title,
    description,
    alternates: { canonical: `/products/${id}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: imageUrl ? [{ url: imageUrl }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-sm font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  );
}

function Spec({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-sm font-semibold text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

export default async function PublicProductDetailPage({ params }: PageProps) {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  const { id } = await params;
  const product = await getProductById(id);

  // Only active products are accessible on the public marketplace
  if (!product || product.status !== "active") {
    notFound();
  }

  const producerName =
    product.farmer?.business_name || product.farmer?.full_name || "Local Producer";
  const producerId = product.farmer?.clerk_id || product.farmer_clerk_id;
  const isOwnListing = Boolean(userId) && userId === producerId;

  const stock = product.quantity_available;
  const moq = product.min_order_quantity > 0 ? product.min_order_quantity : null;
  // Out of stock, or less stock than the minimum order, means it cannot be ordered
  const isAvailable = stock > 0 && (moq === null || stock >= moq);
  const isLowStock = isAvailable && stock <= LOW_STOCK_THRESHOLD;

  const [productReviewSummary, productReviews, sellerReviewSummary, producerProducts] =
    await Promise.all([
      getProductReviewSummary(product.id),
      getProductReviews(product.id),
      getSellerReviewSummary(producerId),
      getActiveProductsByFarmer(producerId).catch(() => []),
    ]);

  const moreFromProducer = producerProducts
    .filter((p) => p.id !== product.id && p.quantity_available > 0)
    .slice(0, 4)
    .map((p) => ({ ...p, farmer: p.farmer ?? product.farmer }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || `${product.name} from Butuan City`,
    image: product.image_url || product.image_path || undefined,
    offers: {
      "@type": "Offer",
      price: product.price_per_unit,
      priceCurrency: "PHP",
      availability: isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: producerName },
    },
  };

  const availabilityBadge = isAvailable ? (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        isLowStock
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-primary/10 text-primary"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          isLowStock ? "bg-amber-600" : "bg-primary"
        )}
      />
      {isLowStock ? "Low stock" : "In stock"} · {stock} {product.unit} available
    </span>
  ) : (
    <Badge variant="secondary" className="px-3 py-1 text-xs">
      {stock > 0 ? "Below minimum order" : "Out of stock"}
    </Badge>
  );

  const producerLocation = product.farmer?.city ? `${product.farmer.city}, Philippines` : null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <MarketplaceHeader activeRoute="products" />

      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="border-b border-border/60 bg-muted/20">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <li>
                  <Link href="/" className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/products" className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Products
                  </Link>
                </li>
                {product.category && (
                  <>
                    <li aria-hidden="true">/</li>
                    <li>
                      <Link
                        href={`/products?category=${product.category.slug}`}
                        className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {product.category.name}
                      </Link>
                    </li>
                  </>
                )}
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="max-w-[12rem] truncate font-medium text-foreground">
                  {product.name}
                </li>
              </ol>
            </nav>
            <Link
              href="/products"
              className="hidden shrink-0 items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
            >
              <RiArrowLeftLine className="size-3.5" aria-hidden="true" />
              Back to marketplace
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:pb-12">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Media */}
            <div className="lg:col-span-6">
              <div className="lg:sticky lg:top-24">
                <ProductGallery
                  images={product.images}
                  productName={product.name}
                  fallbackImagePath={product.image_path}
                  fallbackImageUrl={product.image_url}
                  categoryName={product.category?.name}
                />
              </div>
            </div>

            {/* Decision column: identity → price → purchase → details */}
            <div className="flex flex-col gap-8 lg:col-span-6">
              <section aria-labelledby="product-title" className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  {product.category && (
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {product.category.name}
                    </p>
                  )}
                  <h1
                    id="product-title"
                    className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                  >
                    {product.name}
                  </h1>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <span>Sold by</span>
                    {producerId ? (
                      <Link
                        href={routes.producer(producerId)}
                        className="rounded-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {producerName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground">{producerName}</span>
                    )}
                    {product.farmer?.is_verified && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary">
                        <RiCheckboxCircleFill className="size-4" aria-hidden="true" />
                        Verified producer
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
                    {formatPrice(product.price_per_unit)}
                  </p>
                  <span className="text-base text-muted-foreground">per {product.unit}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {availabilityBadge}
                  {moq !== null && (
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                      Min. order {moq} {product.unit}
                    </span>
                  )}
                </div>
              </section>

              {/* Purchase panel */}
              <section
                id="order"
                aria-labelledby="order-heading"
                className="scroll-mt-24 rounded-xl border border-border bg-card p-5 shadow-2xs"
              >
                {role === "business" && !isOwnListing ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2">
                      <SectionHeading id="order-heading">Place an order</SectionHeading>
                      <Link
                        href={routes.cart}
                        className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        View cart
                        <RiArrowRightLine className="size-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                    {!isAvailable && (
                      <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                        <RiInformationLine className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        {stock > 0
                          ? `Only ${stock} ${product.unit} left, which is below the ${moq} ${product.unit} minimum order.`
                          : "This product is out of stock right now. Check back later or browse similar produce below."}
                      </p>
                    )}
                    <AddToCartControls product={product} />
                  </div>
                ) : isOwnListing || role === "farmer" ? (
                  <div className="flex flex-col gap-3">
                    <SectionHeading id="order-heading">
                      {isOwnListing ? "This is your listing" : "Producer account"}
                    </SectionHeading>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {isOwnListing
                        ? "Buyers see this page when they discover your product. Manage stock and details from your dashboard."
                        : "Ordering is available to business buyer accounts. Producers can manage their own listings from the dashboard."}
                    </p>
                    <Link
                      href="/farmer/products"
                      className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}
                    >
                      Manage my products
                    </Link>
                  </div>
                ) : role === "admin" ? (
                  <div className="flex flex-col gap-3">
                    <SectionHeading id="order-heading">
                      <span className="inline-flex items-center gap-1.5">
                        <RiShieldCheckLine className="size-4 text-primary" aria-hidden="true" />
                        Platform administrator
                      </span>
                    </SectionHeading>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      This listing is active and visible to buyers. Review or moderate it from the admin catalog.
                    </p>
                    <Link
                      href="/admin/products"
                      className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}
                    >
                      Open admin catalog
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div>
                      <SectionHeading id="order-heading">Order this product</SectionHeading>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {isAvailable
                          ? "Sign in with a business account to choose a quantity and add this to your cart."
                          : "This product can’t be ordered right now. Sign in to browse and order other produce."}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={`/sign-in?redirect_url=/products/${product.id}`}
                        className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}
                      >
                        <RiShoppingCart2Line className="size-4" aria-hidden="true" />
                        Sign in to order
                      </Link>
                      <Link
                        href={`/sign-up?redirect_url=/products/${product.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "lg",
                          className: "w-full sm:w-auto",
                        })}
                      >
                        Create a business account
                      </Link>
                    </div>
                  </div>
                )}
              </section>

              {/* Product details */}
              <section aria-labelledby="details-heading" className="flex flex-col gap-4">
                <SectionHeading id="details-heading">Product details</SectionHeading>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-3">
                  <Spec label="Price" value={`${formatPrice(product.price_per_unit)} / ${product.unit}`} />
                  <Spec label="Available" value={`${stock} ${product.unit}`} />
                  <Spec label="Minimum order" value={moq !== null ? `${moq} ${product.unit}` : "No minimum"} />
                  {product.category && <Spec label="Category" value={product.category.name} />}
                  {product.harvest_date && (
                    <Spec
                      label="Harvest date"
                      icon={<RiCalendarEventLine className="size-3" aria-hidden="true" />}
                      value={formatDate(product.harvest_date)}
                    />
                  )}
                  {product.available_until && (
                    <Spec label="Available until" value={formatDate(product.available_until)} />
                  )}
                </dl>
                {product.description && (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {product.description}
                  </p>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Pickup or delivery is chosen at checkout.
                </p>
              </section>

              {/* Producer */}
              <section
                aria-labelledby="producer-heading"
                className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-2xs"
              >
                <SectionHeading id="producer-heading">About the producer</SectionHeading>
                <div className="flex items-start gap-3">
                  <Avatar className="size-11">
                    {product.farmer?.avatar_url && (
                      <AvatarImage src={product.farmer.avatar_url} alt="" />
                    )}
                    <AvatarFallback>{getInitials(producerName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-foreground">
                      {producerName}
                      {product.farmer?.is_verified && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary">
                          <RiCheckboxCircleFill className="size-3.5" aria-hidden="true" />
                          Verified
                        </span>
                      )}
                    </p>
                    {producerLocation && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <RiMapPinLine className="size-3" aria-hidden="true" />
                        {producerLocation}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Producer reviews</span>
                      <ReviewSummary summary={sellerReviewSummary} />
                    </div>
                  </div>
                </div>
                {product.farmer?.bio && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {product.farmer.bio}
                  </p>
                )}
                <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-start">
                  {producerId && (
                    <Link
                      href={routes.producer(producerId)}
                      className={buttonVariants({ variant: "secondary", className: "w-full gap-2 sm:w-auto" })}
                    >
                      <RiStore2Line className="size-4" aria-hidden="true" />
                      View producer profile
                    </Link>
                  )}
                  {!isOwnListing && (
                    <div className="sm:flex-1">
                      <MessageProducerAction producerName={producerName} productId={product.id} />
                    </div>
                  )}
                </div>
              </section>

              {/* Reviews (verified, from completed UMA orders) */}
              <section
                aria-labelledby="reviews-heading"
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div>
                    <SectionHeading id="reviews-heading">Verified buyer reviews</SectionHeading>
                    <div className="mt-1">
                      <ReviewSummary summary={productReviewSummary} />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">Completed UMA orders only</span>
                </div>
                <div className="pt-4">
                  <ReviewList
                    reviews={productReviews}
                    emptyText="No verified reviews for this product yet."
                  />
                </div>
              </section>
            </div>
          </div>

          {/* More from this producer */}
          {moreFromProducer.length > 0 && (
            <section aria-labelledby="more-heading" className="mt-14 flex flex-col gap-5">
              <div className="flex items-end justify-between gap-4">
                <h2 id="more-heading" className="text-xl font-bold tracking-tight text-foreground">
                  More from {producerName}
                </h2>
                {producerId && (
                  <Link
                    href={routes.producer(producerId)}
                    className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    View all
                    <RiArrowRightLine className="size-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {moreFromProducer.map((p) => (
                  <MarketplaceProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Mobile sticky purchase bar: price + jump to the order panel */}
        {!isOwnListing && role !== "farmer" && role !== "admin" && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight tabular-nums text-foreground">
                  {formatPrice(product.price_per_unit)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/ {product.unit}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {isAvailable ? `${stock} ${product.unit} available` : "Unavailable"}
                </p>
              </div>
              {isAvailable ? (
                <a
                  href="#order"
                  className={buttonVariants({ size: "lg", className: "shrink-0" })}
                >
                  {role === "business" ? "Order now" : "Order"}
                </a>
              ) : (
                <Badge variant="secondary" className="shrink-0 px-3 py-1 text-xs">
                  Out of stock
                </Badge>
              )}
            </div>
          </div>
        )}
      </main>

      <MarketplaceFooter />
    </div>
  );
}
