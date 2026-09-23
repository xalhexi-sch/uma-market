import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import {
  RiArrowRightLine,
  RiCheckLine,
  RiStore2Line,
  RiPlantLine,
  RiTruckLine,
  RiSmartphoneLine,
} from "@remixicon/react";
import type { UserRole } from "@/lib/constants";
import { APP_NAME } from "@/lib/constants";
import { LandingNavbar } from "@/components/marketplace/landing-navbar";
import { FreshOnUmaRail } from "@/components/marketplace/fresh-on-uma-rail";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollReveal } from "@/components/marketplace/showcase/scroll-reveal";

function ProductRailSkeleton() {
  return (
    <section className="bg-background py-14 sm:py-18 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Skeleton className="h-5 w-28 mb-2" />
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-w-[260px] flex-shrink-0">
              <Skeleton className="aspect-[4/3] w-full rounded-xl mb-3" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const { isAuthenticated, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  const dashboardHref = role ? `/${role}` : "/onboarding";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Client Landing Navbar (Transparent over hero, solid light on scroll) ── */}
      <LandingNavbar
        isAuthenticated={!!isAuthenticated}
        dashboardHref={dashboardHref}
      />

      <main className="flex-1">
        {/* -- 1. Full-Width Photographic Hero (Approved Foundation) ---- */}
        <section className="relative isolate flex min-h-[580px] sm:min-h-[640px] lg:min-h-[720px] w-full items-center overflow-hidden">
          {/* Full-bleed background image */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <Image
              src="/hero-farmer-sunrise.jpg"
              alt="Butuan farmer harvesting fresh crops at sunrise"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[65%_35%] sm:object-[60%_35%] lg:object-[68%_35%]"
            />
            {/* Top gradient scrim behind transparent navbar to guarantee text and logo contrast */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/35 to-transparent pointer-events-none" />
            {/* Directional readability scrim: dark on left for text contrast, transparent on right for farmer & sunrise */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent sm:from-black/80 sm:via-black/45 lg:from-black/75 lg:via-black/30 lg:to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent sm:hidden" />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 pt-28 pb-20 sm:pt-36 sm:pb-28 lg:pt-40 lg:pb-32">
            <div className="max-w-xl text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Butuan City · Agricultural Marketplace
              </p>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl lg:leading-[1.08]">
                Fresh from Butuan&apos;s farms to your business.
              </h1>

              <p className="mt-5 text-base leading-relaxed text-stone-200 sm:text-lg sm:leading-relaxed">
                Source local produce, check availability, and manage orders
                in one place — directly from the farmers who grow it.
              </p>

              {/* Primary: Explore the market / Secondary: I'm a grower or Dashboard */}
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                {isAuthenticated ? (
                  <>
                    <Link
                      href="/products"
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                    >
                      Explore the market
                      <RiArrowRightLine className="size-4" />
                    </Link>
                    <Link
                      href={dashboardHref}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/20"
                    >
                      Dashboard
                      <RiArrowRightLine className="size-4" />
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/products"
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                    >
                      Explore the market
                      <RiArrowRightLine className="size-4" />
                    </Link>
                    <Link
                      href="#growers"
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/20"
                    >
                      I&apos;m a grower
                      <RiArrowRightLine className="size-4" />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* -- 2. Fresh on UMA — Real Product Rail ------------------- */}
        <Suspense fallback={<ProductRailSkeleton />}>
          <FreshOnUmaRail />
        </Suspense>

        {/* -- 3. The Software Behind the Market — Intro --------------- */}
        <section id="platform" className="border-t border-border/60 bg-muted/20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <ScrollReveal className="text-center max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
                <RiPlantLine className="size-3.5" />
                The Software Behind the Market
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                A complete platform for agricultural trade.
              </h2>
              <p className="mt-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
                UMA is more than a directory. It is purpose-built software that replaces fragmented phone calls, unconfirmed harvest availability, and hidden markups with structured trade tools.
              </p>
            </ScrollReveal>

            {/* Platform 4-Pillar Overview */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <ScrollReveal delay={100} className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <RiStore2Line className="size-5" />
                </div>
                <h3 className="font-semibold text-foreground text-sm">Wholesale Catalog</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Real produce listings with farm-gate pricing, variety details, and verified stock.
                </p>
              </ScrollReveal>

              <ScrollReveal delay={150} className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <RiPlantLine className="size-5" />
                </div>
                <h3 className="font-semibold text-foreground text-sm">Grower Inventory</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Direct harvest management, price controls, and instant availability toggles.
                </p>
              </ScrollReveal>

              <ScrollReveal delay={200} className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                <div className="size-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                  <RiTruckLine className="size-5" />
                </div>
                <h3 className="font-semibold text-foreground text-sm">Order Operations</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Atomic checkout splitting, fulfillment selection, and status progression.
                </p>
              </ScrollReveal>

              <ScrollReveal delay={250} className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
                <div className="size-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                  <RiSmartphoneLine className="size-5" />
                </div>
                <h3 className="font-semibold text-foreground text-sm">Universal Web App</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Zero-install responsive platform accessible on any device in the field or kitchen.
                </p>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* -- 4. Marketplace Showcase: Find Produce ------------------ */}
        <section id="marketplace-showcase" className="border-t border-border/60 bg-background py-18 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              {/* Text Left (5 cols) */}
              <ScrollReveal className="lg:col-span-5 flex flex-col justify-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Marketplace Experience
                </span>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  Find what you need, when you need it.
                </h2>
                <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted-foreground">
                  Browse available produce, compare pricing and supply, and source directly from local growers with transparent specifications.
                </p>

                <ul className="mt-6 space-y-3 text-xs sm:text-sm text-foreground">
                  <li className="flex items-start gap-3">
                    <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <RiCheckLine className="size-3.5" />
                    </div>
                    <span>Daily harvest availability updated by growers</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <RiCheckLine className="size-3.5" />
                    </div>
                    <span>Farm-gate pricing with no intermediary markup</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <RiCheckLine className="size-3.5" />
                    </div>
                    <span>Filter by category, minimum order quantity, and provenance</span>
                  </li>
                </ul>

                <div className="mt-8">
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Explore the market
                    <RiArrowRightLine className="size-4" />
                  </Link>
                </div>
              </ScrollReveal>

              {/* Visual Right (7 cols): High-Resolution Polished Mockup Asset */}
              <ScrollReveal delay={150} className="lg:col-span-7">
                <div className="relative w-full">
                  <Image
                    src="/showcase/marketplace-showcase.webp"
                    alt="UMA Market produce catalog interface showing live crop offerings and farm-gate pricing"
                    width={1900}
                    height={1250}
                    className="w-full h-auto drop-shadow-2xl"
                    priority
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* -- 5. Grower Product Showcase: Sell Produce ---------------- */}
        <section id="growers" className="border-t border-border/60 bg-muted/20 py-18 sm:py-24 lg:py-28 scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              {/* Visual Left on desktop (7 cols): High-Resolution Polished Mockup Asset */}
              <ScrollReveal delay={150} className="lg:col-span-7 order-2 lg:order-1">
                <div className="relative w-full">
                  <Image
                    src="/showcase/grower-showcase.webp"
                    alt="UMA Farmer management portal showing inventory controls, pricing, and live fulfillment metrics"
                    width={1900}
                    height={1250}
                    className="w-full h-auto drop-shadow-2xl"
                  />
                </div>
              </ScrollReveal>

              {/* Text Right (5 cols) */}
              <ScrollReveal className="lg:col-span-5 order-1 lg:order-2 flex flex-col justify-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Grower Platform
                </span>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  Your harvest reaches more buyers.
                </h2>
                <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted-foreground">
                  List your produce, set your prices, manage availability, and receive orders directly from local businesses across Butuan.
                </p>

                <ul className="mt-6 space-y-3 text-xs sm:text-sm text-foreground">
                  <li className="flex items-start gap-3">
                    <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <RiCheckLine className="size-3.5" />
                    </div>
                    <span>Control wholesale batch sizes and harvest dates</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <RiCheckLine className="size-3.5" />
                    </div>
                    <span>Instant stock toggles prevent overselling</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <RiCheckLine className="size-3.5" />
                    </div>
                    <span>Verified Producer badge highlights authentic local growers</span>
                  </li>
                </ul>

                <div className="mt-8">
                  <Link
                    href={isAuthenticated && role === "farmer" ? "/farmer" : "/sign-up"}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    {isAuthenticated && role === "farmer"
                      ? "Open Farmer Dashboard"
                      : "I\u2019m a grower"}
                    <RiArrowRightLine className="size-4" />
                  </Link>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* -- 6. Order + Communication Showcase ----------------------- */}
        <section id="fulfillment-showcase" className="border-t border-border/60 bg-background py-18 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <ScrollReveal className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Fulfillment & Coordination
              </span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                From order to fulfillment.
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted-foreground">
                Coordinate pickup logistics, discuss delivery windows, and track fulfillment step-by-step in one unified thread.
              </p>
            </ScrollReveal>

            {/* Large Order + Chat Showcase Mockup Asset */}
            <ScrollReveal delay={150} className="max-w-5xl mx-auto">
              <div className="relative w-full">
                <Image
                  src="/showcase/order-fulfillment-showcase.webp"
                  alt="UMA order status progression timeline with itemized receipts and live direct chat coordination"
                  width={1900}
                  height={1250}
                  className="w-full h-auto drop-shadow-2xl"
                />
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* -- 7. Mobile / Responsive Product Showcase ---------------- */}
        <section id="mobile-showcase" className="border-t border-border/60 bg-muted/20 py-18 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              {/* Phone Mockup on Left (5 cols): High-Resolution Polished Mockup Asset */}
              <ScrollReveal delay={150} className="lg:col-span-5 flex justify-center">
                <div className="relative max-w-[340px] sm:max-w-[380px] w-full">
                  <Image
                    src="/showcase/mobile-showcase.webp"
                    alt="UMA responsive mobile experience in smartphone frame showing produce search and category browsing"
                    width={1000}
                    height={1500}
                    className="w-full h-auto drop-shadow-2xl"
                  />
                </div>
              </ScrollReveal>

              {/* Text on Right (7 cols) */}
              <ScrollReveal className="lg:col-span-7 flex flex-col justify-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Responsive Web Platform
                </span>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  UMA on every screen.
                </h2>
                <p className="mt-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
                  Whether you&apos;re in the field checking today&apos;s orders or in the kitchen placing a morning replenishment, UMA works seamlessly on any browser without needing an app download.
                </p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
                    <h4 className="font-semibold text-foreground text-sm">
                      Zero App Installation
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Instant access through Safari, Chrome, or any mobile browser. No storage hogging or manual updates.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
                    <h4 className="font-semibold text-foreground text-sm">
                      Field & Kitchen Ready
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Optimized for quick touch interactions, high readability under sunlight, and fast load times.
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-4">
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Browse on any device
                    <RiArrowRightLine className="size-4" />
                  </Link>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* -- 8. How UMA Works (Transition into Action) -------------- */}
        <section id="how" className="border-t border-border/60 bg-background py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <ScrollReveal className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                How it works
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Three steps from farm to order
              </h2>
            </ScrollReveal>

            <div className="mt-10 grid gap-8 border-t border-border/60 pt-8 sm:grid-cols-3 lg:gap-12">
              <ScrollReveal delay={100}>
                <span className="font-mono text-xs font-bold text-primary">01</span>
                <h3 className="mt-3 text-base font-semibold text-foreground">Discover</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Browse active produce listings. Filter by category, price, and availability to find what your kitchen needs.
                </p>
              </ScrollReveal>

              <ScrollReveal delay={200}>
                <span className="font-mono text-xs font-bold text-primary">02</span>
                <h3 className="mt-3 text-base font-semibold text-foreground">Order</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Place wholesale orders at farm-gate prices. Choose between pickup or seller delivery for each order.
                </p>
              </ScrollReveal>

              <ScrollReveal delay={300}>
                <span className="font-mono text-xs font-bold text-primary">03</span>
                <h3 className="mt-3 text-base font-semibold text-foreground">Fulfill</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Coordinate details through order chat. Track status from acceptance through handover.
                </p>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* -- 9. Final CTA ------------------------------------------- */}
        <section className="border-t border-border/60 bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-18 sm:py-24 text-center">
            <ScrollReveal className="max-w-xl mx-auto">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Ready to modernize your produce sourcing?
              </h2>
              <p className="mx-auto mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Whether you grow or buy, UMA connects you to Butuan&apos;s
                agricultural supply chain with structured trade tools.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
                {isAuthenticated ? (
                  <>
                    <Link
                      href="/products"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                    >
                      Explore the market
                      <RiArrowRightLine className="size-4" />
                    </Link>
                    <Link
                      href={dashboardHref}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
                    >
                      Go to Dashboard
                      <RiArrowRightLine className="size-4" />
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/products"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                    >
                      Explore the market
                      <RiArrowRightLine className="size-4" />
                    </Link>
                    <Link
                      href="#growers"
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
                    >
                      I&apos;m a grower
                      <RiArrowRightLine className="size-4" />
                    </Link>
                  </>
                )}
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* -- 10. Footer -------------------------------------------- */}
      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-2.5">
              <Image
                src="/brand/icon/uma-icon-512.png"
                alt="UMA Market"
                width={24}
                height={24}
                className="h-6 w-6 rounded-md shadow-xs shrink-0"
              />
              <span className="text-sm font-bold tracking-tight text-foreground">
                {APP_NAME}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">
                Butuan City, Agusan del Norte
              </span>
            </div>

            <nav className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link href="/products" className="transition-colors hover:text-foreground">
                Market
              </Link>
              <a href="#platform" className="transition-colors hover:text-foreground">
                Platform
              </a>
              <a href="#how" className="transition-colors hover:text-foreground">
                How it works
              </a>
              <a href="#growers" className="transition-colors hover:text-foreground">
                For growers
              </a>
            </nav>
          </div>

          <div className="mt-6 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
            <p>
              &copy; {new Date().getFullYear()} {APP_NAME}. A localized agricultural marketplace for Butuan City.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
