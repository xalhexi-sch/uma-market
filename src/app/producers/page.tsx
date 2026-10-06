import type { Metadata } from "next";
import Link from "next/link";
import { RiPlantLine } from "@remixicon/react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { buttonVariants } from "@/components/ui/button";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { ProducerCard } from "@/components/marketplace/producer-card";
import { getPublicFarmerProfiles } from "@/lib/supabase/queries/public-profiles";
import { routes } from "@/platform/routes";

export const metadata: Metadata = {
  title: "Local Producers | UMA Market",
  description: "Meet local agricultural producers and explore their fresh harvests on UMA Market.",
};

export default async function ProducersPage() {
  const producers = await getPublicFarmerProfiles();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketplaceHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <header className="mb-8 max-w-2xl sm:mb-10">
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <RiPlantLine className="size-4" aria-hidden="true" />
              Local growing partners
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Producers
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Meet the people and businesses supplying fresh agricultural produce across the region.
            </p>
          </header>

          {producers.length === 0 ? (
            <Empty className="rounded-xl border border-dashed border-border bg-card/50 py-12">
              <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
                <RiPlantLine className="size-5" aria-hidden="true" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No producers to show yet</EmptyTitle>
                <EmptyDescription>
                  Check back soon or browse the marketplace for available produce.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link href={routes.products} className={buttonVariants({ size: "sm" })}>
                  Explore products
                </Link>
              </EmptyContent>
            </Empty>
          ) : (
            <section aria-label="Local producers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {producers.map((producer) => (
                <ProducerCard key={producer.clerk_id} producer={producer} />
              ))}
            </section>
          )}
        </div>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
