import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { RiArrowRightLine } from "@remixicon/react";
import type { UserRole } from "@/lib/constants";
import { APP_NAME } from "@/lib/constants";
import { LandingNavbar } from "@/components/marketplace/landing-navbar";
import { FreshOnUmaRail } from "@/components/marketplace/fresh-on-uma-rail";
import { Skeleton } from "@/components/ui/skeleton";

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
        {/* -- 1. Full-Width Photographic Hero ---------------------- */}
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

        {/* -- 3. How UMA Works ------------------------------------- */}
        <section id="how" className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                How it works
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Three steps from farm to order
              </h2>
            </div>

            <div className="mt-10 grid gap-10 border-t border-border/60 pt-8 sm:grid-cols-3 sm:gap-8 lg:gap-12">
              <div>
                <span className="font-mono text-xs font-bold text-primary">01</span>
                <h3 className="mt-3 text-base font-semibold text-foreground">Discover</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Browse active produce listings. Filter by category, price, and availability to find what your kitchen needs.
                </p>
              </div>
              <div>
                <span className="font-mono text-xs font-bold text-primary">02</span>
                <h3 className="mt-3 text-base font-semibold text-foreground">Order</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Place wholesale orders at farm-gate prices. Choose between pickup or seller delivery for each order.
                </p>
              </div>
              <div>
                <span className="font-mono text-xs font-bold text-primary">03</span>
                <h3 className="mt-3 text-base font-semibold text-foreground">Fulfill</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Coordinate details through order chat. Track status from acceptance through handover.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* -- 4. For Growers / For Businesses ---------------------- */}
        <section id="growers" className="border-t border-border/60 bg-muted/20 scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:divide-x lg:divide-border/60">
              {/* For Growers */}
              <div id="farmers" className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    For Growers
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Reach buyers without the middleman
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    List your harvest, set your prices, and receive orders from restaurants, retailers, and caterers in Butuan.
                  </p>

                  <ul className="mt-6 space-y-2.5 text-sm text-foreground">
                    <li className="flex items-start gap-3">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Control your wholesale pricing and batch sizes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>See incoming orders in real time</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Coordinate pickup or delivery with each buyer</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 border-t border-border/60 pt-6">
                  <Link
                    href={isAuthenticated && role === "farmer" ? "/farmer" : "/sign-up"}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    {isAuthenticated && role === "farmer" ? "Open Farmer Dashboard" : "I\u2019m a grower"}
                    <RiArrowRightLine className="size-4" />
                  </Link>
                </div>
              </div>

              {/* For Businesses */}
              <div id="businesses" className="flex flex-col justify-between lg:pl-16">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    For Businesses
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Source produce at farm-gate prices
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Procure fresh ingredients for your kitchen or retail floor — with clear availability, pricing, and fulfillment.
                  </p>

                  <ul className="mt-6 space-y-2.5 text-sm text-foreground">
                    <li className="flex items-start gap-3">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Browse verified farms and active crop listings</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Wholesale pricing without intermediary markups</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Flexible fulfillment — farm pickup or seller delivery</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 border-t border-border/60 pt-6">
                  <Link
                    href={isAuthenticated && role === "business" ? "/business" : "/products"}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    {isAuthenticated && role === "business" ? "Open Business Dashboard" : "Explore the market"}
                    <RiArrowRightLine className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -- 5. Final CTA ------------------------------------------- */}
        <section className="border-t border-border/60 bg-background">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Whether you grow or buy, UMA connects you to Butuan&apos;s
              agricultural supply chain — without the middleman.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
                    className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
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
                    className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
                  >
                    I&apos;m a grower
                    <RiArrowRightLine className="size-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* -- 6. Footer --------------------------------------------- */}
      <footer className="border-t border-border/60 bg-muted/20">
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
              <a href="#how" className="transition-colors hover:text-foreground">
                How it works
              </a>
              <a href="#growers" className="transition-colors hover:text-foreground">
                For growers
              </a>
              <a href="#businesses" className="transition-colors hover:text-foreground">
                For Businesses
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
