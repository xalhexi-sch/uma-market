import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import {
  RiArrowRightLine,
  RiChat3Line,
  RiCheckboxCircleFill,
  RiEyeLine,
  RiMapPin2Line,
  RiShieldCheckLine,
  RiStore2Line,
  RiShoppingBasket2Line,
  RiPlantLine,
} from "@remixicon/react";
import type { UserRole } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/button";
import { LandingNavbar } from "@/components/marketplace/landing-navbar";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import {
  HomeMarketplace,
  HomeMarketplaceSkeleton,
} from "@/components/marketplace/home-marketplace";
import { SectionHeading } from "@/components/marketplace/section-heading";
import { cn } from "@/lib/utils";

const FLOW_STEPS = [
  {
    icon: RiPlantLine,
    label: "Producer",
    title: "Producers list what they grow",
    body: "Farms and agricultural businesses publish products with prices, units, and live availability.",
  },
  {
    icon: RiStore2Line,
    label: "Marketplace",
    title: "UMA keeps it clear and organized",
    body: "One marketplace, one order system. Search, compare, and see exactly who you are buying from.",
  },
  {
    icon: RiShoppingBasket2Line,
    label: "Buyer",
    title: "Buyers order and coordinate directly",
    body: "Place an order, choose pickup or delivery, and talk to the producer in one conversation.",
  },
] as const;

const TRUST_POINTS = [
  {
    icon: RiShieldCheckLine,
    title: "Verified producers",
    body: "Verification is shown on products and producer pages, so you can tell who has been checked.",
  },
  {
    icon: RiEyeLine,
    title: "Transparent product and order flow",
    body: "Prices, units, minimum orders, and stock are visible before you order. Order status is tracked end to end.",
  },
  {
    icon: RiMapPin2Line,
    title: "Local by design",
    body: "Built around Butuan City and Agusan del Norte, so sourcing stays close and relationships stay personal.",
  },
  {
    icon: RiChat3Line,
    title: "One conversation per relationship",
    body: "Questions, orders, and follow-ups live in a single thread with each business you work with.",
  },
] as const;

export default async function HomePage() {
  const { isAuthenticated, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  const dashboardHref = role ? `/${role}` : "/onboarding";
  const isProducer = !!isAuthenticated && role === "farmer";

  const secondaryCta = isAuthenticated
    ? { href: dashboardHref, label: "Go to dashboard" }
    : { href: "/sign-up", label: "Sell on UMA" };

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
      <LandingNavbar
        isAuthenticated={!!isAuthenticated}
        dashboardHref={dashboardHref}
        overHero={false}
      />

      <main className="flex-1 overflow-x-clip">
        {/* ── 1. Hero ──────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-20"
        >
          {/* Quiet background: soft accent glow + faint grid */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-32 right-[-10%] size-[520px] rounded-full bg-green-500/10 blur-3xl dark:bg-green-500/10" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
          </div>

          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10">
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-700 motion-reduce:animate-none lg:col-span-6">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-2xs">
                <span aria-hidden className="relative flex size-2">
                  <span className="absolute inline-flex size-full rounded-full bg-green-500/60 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                </span>
                Butuan City&apos;s local agricultural marketplace
              </p>

              <h1
                id="hero-heading"
                className="mt-5 text-4xl font-bold tracking-tight text-foreground text-balance sm:text-5xl lg:text-6xl lg:leading-[1.05]"
              >
                Buy directly from the people who{" "}
                <span className="text-primary dark:text-emerald-400">grow it.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                UMA connects buyers with local agricultural producers. Browse
                live availability, order at clear prices, and coordinate with
                the producer in one place.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/products"
                  className={cn(buttonVariants({ size: "lg" }), "h-11 px-6 text-sm")}
                >
                  Browse products
                  <RiArrowRightLine aria-hidden />
                </Link>
                <Link
                  href={secondaryCta.href}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-11 px-6 text-sm",
                  )}
                >
                  {secondaryCta.label}
                </Link>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {["Verified producers", "Live availability", "Direct ordering"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <RiCheckboxCircleFill
                        aria-hidden
                        className="size-4 text-green-500"
                      />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            {/* Composition: photo + overlaid flow card */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 motion-reduce:animate-none lg:col-span-6">
              <div className="relative mx-auto max-w-xl lg:max-w-none">
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-muted shadow-lg sm:aspect-[5/4]">
                  <Image
                    src="/hero-farmer-sunrise.jpg"
                    alt="A local farmer harvesting fresh crops at sunrise"
                    fill
                    priority
                    sizes="(min-width: 1024px) 560px, (min-width: 640px) 576px, 100vw"
                    className="object-cover object-[65%_40%]"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"
                  />
                </div>

                <div className="absolute -bottom-6 left-4 right-4 rounded-2xl border border-border bg-card/95 p-4 shadow-md backdrop-blur-sm sm:left-6 sm:right-auto sm:w-80">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <RiPlantLine aria-hidden className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Direct from the producer
                      </p>
                      <p className="text-xs text-muted-foreground">
                        See who grows it, what&apos;s in stock, and the price per unit.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2 + 4. Live discovery preview + local producers ── */}
        <Suspense fallback={<HomeMarketplaceSkeleton />}>
          <HomeMarketplace isProducer={isProducer} />
        </Suspense>

        {/* ── 3. How UMA works ─────────────────────────────── */}
        <section
          id="how"
          aria-labelledby="how-heading"
          className="scroll-mt-20 border-t border-border/60 bg-background py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              id="how-heading"
              eyebrow="How UMA works"
              title="From the field to your kitchen in three steps"
            />

            <ol className="mt-10 grid gap-4 md:grid-cols-3 lg:gap-5">
              {FLOW_STEPS.map((step, index) => (
                <li
                  key={step.label}
                  className="relative flex flex-col rounded-2xl border border-border bg-card p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <step.icon aria-hidden className="size-5" />
                    </span>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-primary dark:text-emerald-400">
                    {step.label}
                  </p>
                  <h3 className="mt-1.5 text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                  {index < FLOW_STEPS.length - 1 && (
                    <RiArrowRightLine
                      aria-hidden
                      className="absolute -right-3.5 top-1/2 hidden size-6 -translate-y-1/2 rounded-full border border-border bg-background p-1 text-muted-foreground md:block"
                    />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 5. Trust ─────────────────────────────────────── */}
        <section
          aria-labelledby="trust-heading"
          className="border-t border-border/60 bg-muted/30 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <SectionHeading
                id="trust-heading"
                eyebrow="Built on trust"
                title="A marketplace you can see into"
                description="UMA keeps sourcing simple and accountable, with nothing hidden between the producer and the buyer."
              />
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
              {TRUST_POINTS.map((point) => (
                <li
                  key={point.title}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <point.icon aria-hidden className="size-[18px]" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {point.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {point.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 6. Final CTA ─────────────────────────────────── */}
        <section
          aria-labelledby="cta-heading"
          className="border-t border-border/60 bg-background px-4 py-16 sm:px-6 sm:py-20"
        >
          <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center sm:px-12 sm:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-0 -z-10 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500/15 blur-3xl"
            />
            <h2
              id="cta-heading"
              className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-foreground text-balance sm:text-4xl"
            >
              Fresh, local, and a conversation away.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Start browsing what local producers have available today, or bring
              your own products to the marketplace.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/products"
                className={cn(buttonVariants({ size: "lg" }), "h-11 px-6 text-sm")}
              >
                Browse products
                <RiArrowRightLine aria-hidden />
              </Link>
              <Link
                href={isProducer ? "/farmer" : isAuthenticated ? dashboardHref : "/sign-up"}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 px-6 text-sm",
                )}
              >
                {isAuthenticated ? "Go to dashboard" : "Become a producer"}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketplaceFooter />
    </div>
  );
}
