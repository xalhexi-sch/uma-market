import type { Metadata } from "next";
import Link from "next/link";
import {
  RiArrowRightLine,
  RiCheckLine,
  RiStore2Line,
  RiPlantLine,
  RiTruckLine,
  RiShieldCheckLine,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About UMA Market",
  description:
    "UMA Market connects local agricultural growers in Butuan with commercial buyers so produce can be listed, sourced, ordered, and fulfilled directly.",
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketplaceHeader activeRoute="about" />

      <main className="flex-1">
        {/* Editorial Header */}
        <section className="border-b border-border/60 bg-muted/20 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              About {APP_NAME}
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Direct agricultural trade for Butuan City.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground sm:text-xl">
              UMA Market connects local agricultural growers with commercial buyers so produce can be listed, sourced, ordered, and fulfilled directly through one marketplace.
            </p>
          </div>
        </section>

        {/* Core Pillars */}
        <section className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-16">
            {/* 1. The Regional Agricultural Problem */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                The problem in regional produce trade
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted-foreground">
                In Butuan City and surrounding agricultural areas, the supply chain between farm harvest and commercial kitchen has historically relied on fragmented phone calls, unconfirmed harvest availability, and multiple informal middlemen.
              </p>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted-foreground">
                Farmers face price uncertainty and inconsistent off-take, while restaurants, school canteens, hotels, and grocers face unexpected price spikes, unreliable delivery timelines, and lack of origin visibility.
              </p>
            </div>

            {/* 2. What Makes UMA Different */}
            <div className="border-t border-border/60 pt-12">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Structured trade instead of ad-hoc messaging
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted-foreground">
                UMA Market is built as purpose-driven digital trade infrastructure. It replaces unverified estimates with concrete product listings and enforceable trade details.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <RiPlantLine className="size-5" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">Farm-Gate Pricing</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Growers set their own prices per kilogram or bundle. Commercial buyers purchase at source rates without hidden markups.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                  <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                    <RiShieldCheckLine className="size-5" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">Verified In-Stock Batches</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Listings reflect actual harvested or ready-to-harvest volume, minimum order quantities, and specified harvest dates.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                  <div className="size-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                    <RiTruckLine className="size-5" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">Fulfillment Flexibility</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Every order specifies either grower delivery or farm pickup with transparent fulfillment terms and direct coordination.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                  <div className="size-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                    <RiStore2Line className="size-5" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">Direct Commercial Counterparties</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Transactions connect registered businesses directly with local producers, establishing recurring, transparent relationships.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Who UMA Serves */}
            <div className="border-t border-border/60 pt-12">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Who UMA serves in Butuan City
              </h2>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-border/70 bg-card p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    For Commercial Buyers
                  </span>
                  <h3 className="mt-2 text-lg font-bold text-foreground">
                    Restaurants, Grocers & Caterers
                  </h3>
                  <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    UMA helps commercial kitchens source wholesale ingredients with predictable availability, clear pricing, and direct communication with growers.
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-foreground">
                    <li className="flex items-center gap-2">
                      <RiCheckLine className="size-4 text-primary shrink-0" />
                      <span>Browse live daily harvest availability</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <RiCheckLine className="size-4 text-primary shrink-0" />
                      <span>Order directly at wholesale farm-gate prices</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <RiCheckLine className="size-4 text-primary shrink-0" />
                      <span>Coordinate delivery or pickup schedules</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    For Agricultural Growers
                  </span>
                  <h3 className="mt-2 text-lg font-bold text-foreground">
                    Farmers & Producer Cooperatives
                  </h3>
                  <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    UMA gives farmers a direct digital sales channel to commercial businesses, eliminating reliance on roadside spot markets and distress pricing.
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-foreground">
                    <li className="flex items-center gap-2">
                      <RiCheckLine className="size-4 text-primary shrink-0" />
                      <span>Maintain independent pricing and inventory controls</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <RiCheckLine className="size-4 text-primary shrink-0" />
                      <span>Receive structured, committed orders before dispatch</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <RiCheckLine className="size-4 text-primary shrink-0" />
                      <span>Build long-term direct business clientele</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 4. Butuan Local Focus */}
            <div className="border-t border-border/60 pt-12">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Localized to the Caraga agricultural corridor
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted-foreground">
                UMA Market is designed specifically for Butuan City and Agusan del Norte. Logistics, harvest calendars, crop varieties (from ginger and squash to native tomatoes and root crops), and trade practices are tailored to the physical reality of local producers and businesses.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-border/60 bg-muted/20 py-16 text-center">
          <div className="mx-auto max-w-xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Start sourcing or listing local produce today.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Explore available harvests or register your farm on UMA Market.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
              >
                Explore the market
                <RiArrowRightLine className="size-4" />
              </Link>
              <Link
                href="/#growers"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
              >
                I&apos;m a grower
                <RiArrowRightLine className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketplaceFooter />
    </div>
  );
}
