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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  getPublicFarmerProfile,
  getActiveProductsByFarmer,
} from "@/lib/supabase/queries/public-profiles";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const farmer = await getPublicFarmerProfile(id);
  if (!farmer) return { title: "Producer Not Found — UMA Market" };

  const displayName =
    farmer.business_name || farmer.full_name || "Local Agricultural Producer";

  return {
    title: `${displayName} — Producer Profile | UMA Market`,
    description:
      farmer.bio ||
      `Source fresh, verified agricultural harvests directly from ${displayName} in ${farmer.city || "Butuan City"}, Philippines.`,
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "FM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function PublicFarmerProfilePage({ params }: PageProps) {
  const { id } = await params;

  // Fetch farmer profile and products in parallel
  const [farmer, rawProducts] = await Promise.all([
    getPublicFarmerProfile(id),
    getActiveProductsByFarmer(id),
  ]);

  // If farmer does not exist or is not a registered farmer, return 404
  if (!farmer) {
    notFound();
  }

  // Attach public farmer provenance to each product for consistent card rendering
  const products = rawProducts.map((p) => ({
    ...p,
    farmer: {
      clerk_id: farmer.clerk_id,
      full_name: farmer.full_name,
      business_name: farmer.business_name,
      city: farmer.city,
      avatar_url: farmer.avatar_url,
      bio: farmer.bio,
      is_verified: farmer.is_verified,
    },
  }));

  const displayName =
    farmer.business_name || farmer.full_name || "Local Producer";
  const initials = getInitials(displayName);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Shared Minimal Public Header */}
      <MarketplaceHeader />

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
                Marketplace
              </Link>
              <span>/</span>
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {displayName}
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

        {/* Profile Content Container */}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          {/* Farmer Identity Card */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              {/* Avatar with fallback */}
              <Avatar className="size-20 sm:size-24 border-2 border-border/80 shadow-xs shrink-0">
                {farmer.avatar_url && (
                  <AvatarImage src={farmer.avatar_url} alt={displayName} />
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
                  {farmer.is_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      <RiCheckboxCircleFill className="size-3.5" />
                      <span>Verified Producer</span>
                    </span>
                  )}
                </div>

                {/* Manager / Contact Person if different from farm name */}
                {farmer.business_name &&
                  farmer.full_name &&
                  farmer.business_name !== farmer.full_name && (
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                      Managed by {farmer.full_name}
                    </p>
                  )}

                {/* Provenance metadata pills */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1">
                    <RiMapPinLine className="size-3.5 text-primary shrink-0" />
                    <span className="font-medium text-foreground">
                      {farmer.city || "Butuan City"}
                    </span>
                    <span>· Philippines</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1">
                    <RiPlantLine className="size-3.5 text-primary shrink-0" />
                    <span className="font-medium text-foreground">
                      {products.length}
                    </span>
                    <span>active listing{products.length === 1 ? "" : "s"}</span>
                  </div>
                </div>

                {/* Farm Description / Bio */}
                {farmer.bio && (
                  <div className="mt-5 pt-5 border-t border-border/60">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      About this Farm & Harvest
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                      {farmer.bio}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Products Section */}
          <section className="mt-10 sm:mt-12">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Available Harvest
                </h2>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                  Fresh produce currently available for wholesale procurement directly from this farm.
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
                    This farm has no active listings on the marketplace right now. Check back soon for the next harvest or explore other verified local growers.
                  </EmptyDescription>
                </EmptyHeader>
                <div className="mt-2">
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                  >
                    <span>Explore Marketplace</span>
                    <RiArrowRightLine className="size-3.5" />
                  </Link>
                </div>
              </Empty>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <MarketplaceProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Shared Marketplace Footer */}
      <MarketplaceFooter />
    </div>
  );
}
