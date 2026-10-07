import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiMapPinLine,
  RiPlantLine,
  RiCheckboxCircleFill,
  RiStore2Line,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceProductCard } from "@/components/marketplace/marketplace-product-card";
import { MessageProducerAction } from "@/components/products/message-producer-action";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  getPublicFarmerProfile,
  getActiveProductsByFarmer,
} from "@/lib/supabase/queries/public-profiles";
import { getSellerReviewSummary, getSellerReviews } from "@/lib/supabase/queries/reviews";
import { ReviewList } from "@/components/reviews/review-list";
import { ReviewSummary } from "@/components/reviews/review-summary";
import { routes } from "@/platform/routes";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const producer = await getPublicFarmerProfile(id);
  if (!producer) return { title: "Producer Not Found — UMA Market" };

  const displayName =
    producer.business_name || producer.full_name || "Local Agricultural Producer";

  return {
    title: `${displayName} — Producer Profile | UMA Market`,
    description:
      producer.bio ||
      `Source fresh, verified agricultural harvests directly from ${displayName} in ${producer.city || "Butuan City"}, Philippines.`,
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "PR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function PublicProducerProfilePage({ params }: PageProps) {
  const { id } = await params;

  // Fetch producer profile, active products, and reviews in parallel
  const [producer, rawProducts, reviewSummary, reviews] = await Promise.all([
    getPublicFarmerProfile(id),
    getActiveProductsByFarmer(id),
    getSellerReviewSummary(id),
    getSellerReviews(id),
  ]);

  // If producer does not exist or is not a registered producer, 404
  if (!producer) {
    notFound();
  }

  // Attach public producer provenance to each product for consistent card rendering
  const products = rawProducts.map((p) => ({
    ...p,
    farmer: {
      clerk_id: producer.clerk_id,
      full_name: producer.full_name,
      business_name: producer.business_name,
      city: producer.city,
      avatar_url: producer.avatar_url,
      bio: producer.bio,
      is_verified: producer.is_verified,
    },
  }));

  const displayName =
    producer.business_name || producer.full_name || "Local Producer";
  const initials = getInitials(displayName);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Shared Minimal Public Header */}
      <MarketplaceHeader />

      <main className="flex-1">
        {/* Navigation Breadcrumb */}
        <nav aria-label="Breadcrumb" className="border-b border-border/60 bg-muted/20">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <ol className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <li>
                <Link href={routes.home} className="hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={routes.products} className="hover:text-foreground transition-colors">
                  Marketplace
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-medium text-foreground truncate max-w-[200px]">
                {displayName}
              </li>
            </ol>

            <Link
              href={routes.products}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <RiArrowLeftLine className="size-3.5" aria-hidden="true" />
              <span>Back to Marketplace</span>
            </Link>
          </div>
        </nav>

        {/* Profile Content Container */}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          {/* Producer Identity Card */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xs">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col sm:flex-row sm:items-start gap-6 flex-1 min-w-0">
                {/* Avatar with fallback */}
                <Avatar className="size-20 sm:size-24 border-2 border-border/80 shadow-xs shrink-0">
                  {producer.avatar_url && (
                    <AvatarImage src={producer.avatar_url} alt={displayName} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {/* Identity & Badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      {displayName}
                    </h1>
                    {producer.is_verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary border border-primary/20">
                        <RiCheckboxCircleFill className="size-3.5" aria-hidden="true" />
                        <span>Verified Producer</span>
                      </span>
                    )}
                  </div>

                  {/* Manager / Contact Person if different from farm name */}
                  {producer.business_name &&
                    producer.full_name &&
                    producer.business_name !== producer.full_name && (
                      <p className="mt-1 text-sm font-medium text-muted-foreground">
                        Managed by {producer.full_name}
                      </p>
                    )}

                  {/* Provenance metadata pills */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1">
                      <RiMapPinLine className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                      <span className="font-medium text-foreground">
                        {producer.city || "Butuan City"} · Philippines
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1">
                      <RiPlantLine className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                      <span className="font-medium text-foreground">
                        {products.length} {products.length === 1 ? "active listing" : "active listings"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1">
                      <span className="font-medium text-foreground">Reputation</span>
                      <ReviewSummary summary={reviewSummary} />
                    </div>
                  </div>

                  {/* Farm Description / Bio */}
                  {producer.bio && (
                    <div className="mt-5 pt-5 border-t border-border/60">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        About this Producer
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                        {producer.bio}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Message Producer Action */}
              <div className="w-full lg:w-72 shrink-0 border-t border-border/60 pt-5 lg:border-t-0 lg:pt-0">
                <MessageProducerAction producerName={displayName} producerId={producer.clerk_id} />
              </div>
            </div>
          </div>

          {/* Active Products Section */}
          <section aria-labelledby="products-heading" className="mt-10 sm:mt-12">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 id="products-heading" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Available Products
                </h2>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                  Fresh produce currently available for wholesale procurement directly from this producer.
                </p>
              </div>
              {products.length > 0 && (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground shrink-0">
                  {products.length} {products.length === 1 ? "Listing" : "Listings"}
                </span>
              )}
            </div>

            {/* Product Grid or Empty State */}
            {products.length === 0 ? (
              <Empty className="py-12 border rounded-xl border-dashed border-border bg-card/50">
                <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
                  <RiStore2Line className="size-5" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle className="text-base font-semibold">
                    No produce currently listed
                  </EmptyTitle>
                  <EmptyDescription className="text-xs text-muted-foreground max-w-sm">
                    This producer has no active listings on the marketplace right now. Check back soon for the next harvest or explore other verified local growers.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="mt-2">
                  <Link
                    href={routes.products}
                    className={buttonVariants({ variant: "default", size: "sm", className: "gap-1.5" })}
                  >
                    <span>Explore Marketplace</span>
                    <RiArrowRightLine className="size-3.5" aria-hidden="true" />
                  </Link>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <MarketplaceProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>

          {/* Verified Buyer Reviews */}
          <section aria-labelledby="reviews-heading" className="mt-10 sm:mt-12 rounded-xl border border-border bg-card p-5 shadow-2xs sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <h2 id="reviews-heading" className="text-lg font-bold tracking-tight text-foreground">
                  Verified Buyer Reviews
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Feedback from completed UMA orders only.
                </p>
              </div>
              <ReviewSummary summary={reviewSummary} />
            </div>
            <div className="pt-4">
              <ReviewList reviews={reviews} emptyText="No verified buyer reviews yet." />
            </div>
          </section>
        </div>
      </main>

      {/* Shared Marketplace Footer */}
      <MarketplaceFooter />
    </div>
  );
}
