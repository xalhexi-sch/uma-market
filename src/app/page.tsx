import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { RiPlantLine, RiArrowRightLine } from "@remixicon/react";
import type { UserRole } from "@/lib/constants";
import { APP_NAME } from "@/lib/constants";

export default async function HomePage() {
  const { isAuthenticated, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  const dashboardHref = role ? `/${role}` : "/onboarding";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <RiPlantLine className="size-4.5" />
            </div>
            <span className="text-base font-bold tracking-tight text-foreground">
              {APP_NAME}
            </span>
          </Link>

          {/* Center nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {[
              { label: "How it works", href: "#how" },
              { label: "For Farmers", href: "#farmers" },
              { label: "For Businesses", href: "#businesses" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Auth CTAs */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  href={dashboardHref}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                >
                  Dashboard
                </Link>
                <UserButton />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-foreground transition-colors hover:text-primary"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

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
            {/* Directional readability scrim: dark on left for text contrast, transparent on right for farmer & sunrise */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent sm:from-black/80 sm:via-black/45 lg:from-black/75 lg:via-black/30 lg:to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent sm:hidden" />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 py-20 sm:py-28 lg:py-32">
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

              {/* Only two CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                {isAuthenticated ? (
                  <Link
                    href={dashboardHref}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                  >
                    Go to Dashboard
                    <RiArrowRightLine className="size-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/sign-up"
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                    >
                      Explore products
                      <RiArrowRightLine className="size-4" />
                    </Link>
                    <Link
                      href="#farmers"
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/20"
                    >
                      Sell on UMA
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* -- 2. Compact Value / Proof Strip ----------------------- */}
        <section className="border-b border-border/60 bg-background">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-7">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8 sm:divide-x sm:divide-border/60">
              <div className="sm:pr-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Origin</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Grown in Butuan City</p>
              </div>
              <div className="sm:px-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Trade</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Direct farm-gate pricing</p>
              </div>
              <div className="sm:px-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Access</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Equal market access</p>
              </div>
              <div className="sm:pl-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Supply</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Reliable wholesale delivery</p>
              </div>
            </div>
          </div>
        </section>

        {/* -- 3. How UMA Works ------------------------------------- */}
        <section id="how" className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24 lg:py-28">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Process
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              How UMA works
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              A straightforward three-step connection between local agricultural harvest and commercial demand.
            </p>
          </div>

          <div className="mt-12 grid gap-10 border-t border-border/60 pt-10 sm:grid-cols-3 sm:gap-8 lg:gap-12">
            <div>
              <span className="font-mono text-xs font-bold text-primary">01</span>
              <h3 className="mt-3 text-base font-semibold text-foreground">Discover</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Browse fresh produce listings from verified Butuan farmers. Filter by category, price, and harvest availability.
              </p>
            </div>
            <div>
              <span className="font-mono text-xs font-bold text-primary">02</span>
              <h3 className="mt-3 text-base font-semibold text-foreground">Order</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Place wholesale orders directly with the grower. Choose between direct farm pickup or seller delivery.
              </p>
            </div>
            <div>
              <span className="font-mono text-xs font-bold text-primary">03</span>
              <h3 className="mt-3 text-base font-semibold text-foreground">Fulfill</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Coordinate details through threaded order chat. Track status updates from acceptance through handover.
              </p>
            </div>
          </div>
        </section>

        {/* -- 4. For Farmers / For Businesses ---------------------- */}
        <section className="border-t border-border/60 bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:divide-x lg:divide-border/60">
              {/* For Farmers */}
              <div id="farmers" className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Growers & Producers
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    For Farmers
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    List your harvest, set fair prices, and supply local businesses — directly, fairly, and without intermediary markups.
                  </p>

                  <ul className="mt-6 space-y-3 text-sm text-foreground">
                    <li className="flex items-start gap-3">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Full control over your wholesale pricing and batch quantities</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Real-time visibility into incoming commercial orders</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Direct messaging to coordinate pickup or delivery logistics</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Build stable relationships with local restaurants and retailers</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 border-t border-border/60 pt-6">
                  <Link
                    href={isAuthenticated && role === "farmer" ? "/farmer" : "/sign-up"}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    {isAuthenticated && role === "farmer" ? "Open Farmer Dashboard" : "Sell on UMA"}
                    <RiArrowRightLine className="size-4" />
                  </Link>
                </div>
              </div>

              {/* For Businesses */}
              <div id="businesses" className="flex flex-col justify-between lg:pl-16">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Commercial Buyers
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    For Businesses
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Procure fresh produce directly from Butuan farms for your kitchen or retail store. Direct from the source.
                  </p>

                  <ul className="mt-6 space-y-3 text-sm text-foreground">
                    <li className="flex items-start gap-3">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Browse verified local farms and active crop listings</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Transparent wholesale pricing without middleman markups</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Flexible fulfillment: choose farm pickup or seller delivery</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>Support Butuan City&apos;s local farming community</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 border-t border-border/60 pt-6">
                  <Link
                    href={isAuthenticated && role === "business" ? "/business" : "/sign-up"}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    {isAuthenticated && role === "business" ? "Open Business Dashboard" : "Start sourcing"}
                    <RiArrowRightLine className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -- 5. Final CTA ------------------------------------------- */}
        <section className="border-t border-border/60 bg-background">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Join the growing network of Butuan farmers and commercial buyers
              building a stronger, direct, and more transparent local food system.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {isAuthenticated ? (
                <Link
                  href={dashboardHref}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                >
                  Go to Dashboard
                  <RiArrowRightLine className="size-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                  >
                    Explore products
                    <RiArrowRightLine className="size-4" />
                  </Link>
                  <Link
                    href="/sign-in"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Already have an account? Sign in →
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
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <RiPlantLine className="size-3.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground">
                {APP_NAME}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">
                Butuan City, Agusan del Norte
              </span>
            </div>

            <nav className="flex items-center gap-6 text-xs text-muted-foreground">
              <a href="#how" className="transition-colors hover:text-foreground">
                How it works
              </a>
              <a href="#farmers" className="transition-colors hover:text-foreground">
                For Farmers
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

