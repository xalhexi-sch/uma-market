import Link from "next/link";
import {
  RiArrowRightLine,
  RiCheckboxCircleFill,
  RiErrorWarningLine,
  RiMapPinLine,
  RiPlantLine,
  RiStore2Line,
} from "@remixicon/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketplaceProductCard } from "@/components/marketplace/marketplace-product-card";
import { SectionHeading } from "@/components/marketplace/section-heading";
import { getActiveProducts } from "@/lib/supabase/queries/products";
import { routes } from "@/platform/routes";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

const PRODUCT_LIMIT = 8;
const FEATURED_PRODUCTS = 4;
const FEATURED_PRODUCERS = 3;

interface ProducerSummary {
  clerkId: string;
  name: string;
  city: string;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  productCount: number;
  sampleProducts: string[];
}

/** Derive distinct producers from the live product set (no extra query). */
function summarizeProducers(products: Product[]): ProducerSummary[] {
  const map = new Map<string, ProducerSummary>();
  for (const product of products) {
    const farmer = product.farmer;
    const id = farmer?.clerk_id ?? product.farmer_clerk_id;
    if (!farmer || !id) continue;
    const existing = map.get(id);
    if (existing) {
      existing.productCount += 1;
      if (existing.sampleProducts.length < 3) {
        existing.sampleProducts.push(product.name);
      }
      continue;
    }
    map.set(id, {
      clerkId: id,
      name: farmer.business_name || farmer.full_name || "Local producer",
      city: farmer.city,
      avatarUrl: farmer.avatar_url,
      bio: farmer.bio,
      isVerified: farmer.is_verified,
      productCount: 1,
      sampleProducts: [product.name],
    });
  }
  // Verified producers first, then by listing count.
  return [...map.values()].sort(
    (a, b) =>
      Number(b.isVerified) - Number(a.isVerified) ||
      b.productCount - a.productCount,
  );
}

export function HomeMarketplaceSkeleton() {
  return (
    <>
      <section
        aria-hidden
        className="border-t border-border/60 bg-background py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-9 w-72 max-w-full" />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: FEATURED_PRODUCTS }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-2 h-5 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section
        aria-hidden
        className="border-t border-border/60 bg-muted/30 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-9 w-80 max-w-full" />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {Array.from({ length: FEATURED_PRODUCERS }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function DiscoveryStatus({ error }: { error: boolean }) {
  return (
    <Empty className="mt-10 rounded-2xl border border-dashed border-border bg-card/50">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {error ? <RiErrorWarningLine /> : <RiPlantLine />}
        </EmptyMedia>
        <EmptyTitle>
          {error ? "We couldn’t load the market right now" : "New harvests are on the way"}
        </EmptyTitle>
        <EmptyDescription>
          {error
            ? "Please try again in a moment, or open the full marketplace."
            : "No products are listed at the moment. Producers update availability as they harvest."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/products" className={buttonVariants({ variant: "outline" })}>
          Open the marketplace
        </Link>
      </EmptyContent>
    </Empty>
  );
}

function ProducerCard({ producer }: { producer: ProducerSummary }) {
  return (
    <li>
      <Link
        href={routes.producer(producer.clerkId)}
        className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            {producer.avatarUrl ? (
              <AvatarImage src={producer.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              <RiStore2Line className="size-5" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <span className="truncate group-hover:text-primary transition-colors">
                {producer.name}
              </span>
              {producer.isVerified && (
                <RiCheckboxCircleFill
                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-label="Verified producer"
                />
              )}
            </p>
            {producer.city && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <RiMapPinLine className="size-3.5" aria-hidden />
                {producer.city}
              </p>
            )}
          </div>
        </div>

        {producer.bio && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {producer.bio}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {producer.sampleProducts.map((name) => (
            <span
              key={name}
              className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground"
            >
              {name}
            </span>
          ))}
        </div>
      </Link>
    </li>
  );
}

/**
 * Live marketplace sections of the public homepage: discovery preview and
 * local producers. Both derive from a single products query.
 */
export async function HomeMarketplace({ isProducer }: { isProducer: boolean }) {
  let products: Product[] = [];
  let failed = false;
  try {
    products = await getActiveProducts({
      inStockOnly: true,
      sort: "newest",
      limit: PRODUCT_LIMIT,
    });
  } catch (error) {
    console.error("[home] failed to load marketplace preview:", error);
    failed = true;
  }

  const featured = products.slice(0, FEATURED_PRODUCTS);
  const producers = summarizeProducers(products).slice(0, FEATURED_PRODUCERS);

  return (
    <>
      {/* ── Discovery preview ───────────────────────────────── */}
      <section
        aria-labelledby="discover-heading"
        className="border-t border-border/60 bg-background py-16 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            id="discover-heading"
            eyebrow="Fresh on UMA"
            title="What local producers have available now"
            description="Real listings, real prices per unit, and the producer behind every product."
            action={
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                View all products
                <RiArrowRightLine className="size-4" aria-hidden />
              </Link>
            }
          />

          {featured.length > 0 ? (
            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {featured.map((product) => (
                <li key={product.id} className="flex">
                  <div className="w-full">
                    <MarketplaceProductCard product={product} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <DiscoveryStatus error={failed} />
          )}
        </div>
      </section>

      {/* ── Local producers ─────────────────────────────────── */}
      <section
        id="growers"
        aria-labelledby="producers-heading"
        className="scroll-mt-20 border-t border-border/60 bg-muted/30 py-16 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            id="producers-heading"
            eyebrow="Local producers"
            title="Know exactly who grows your food"
            description="Every listing links to its producer. Buy direct, ask questions, and build relationships with the farms and businesses near you."
          />

          {producers.length > 0 ? (
            <ul className="mt-10 grid gap-4 md:grid-cols-3 lg:gap-5">
              {producers.map((producer) => (
                <ProducerCard key={producer.clerkId} producer={producer} />
              ))}
            </ul>
          ) : (
            <Empty className="mt-10 rounded-2xl border border-dashed border-border bg-card/50">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <RiStore2Line />
                </EmptyMedia>
                <EmptyTitle>Producers are joining UMA</EmptyTitle>
                <EmptyDescription>
                  Be among the first local producers to list on the marketplace.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          <div className="mt-10 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="font-semibold text-foreground">
                Grow or supply agricultural products?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                List your products, manage availability, and receive orders from local businesses.
              </p>
            </div>
            <Link
              href={isProducer ? "/farmer" : "/sign-up"}
              className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
            >
              {isProducer ? "Open your dashboard" : "Become a producer"}
              <RiArrowRightLine aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
