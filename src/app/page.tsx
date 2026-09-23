import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import {
  RiPlantLine,
  RiBuildingLine,
  RiArrowRightLine,
  RiCheckLine,
  RiSearchLine,
  RiShoppingBagLine,
  RiTruckLine,
  RiShieldCheckLine,
} from "@remixicon/react";
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
        {/* ── 1. Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-background">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
              {/* Left Column: Text & CTAs */}
              <div className="flex flex-col justify-center">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
                  <RiPlantLine className="size-3.5 shrink-0" />
                  <span>Butuan City · Agricultural Marketplace</span>
                </div>

                <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl lg:leading-[1.12]">
                  Fresh from Butuan&apos;s farms to your business.
                </h1>

                <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg sm:leading-relaxed">
                  Source local produce, check availability, and manage orders
                  in one place — directly from the farmers who grow it.
                </p>

                <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
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
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        Sell on UMA
                      </Link>
                    </>
                  )}
                </div>

                {/* Agricultural Trust Highlights */}
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5 border-t border-border/70 pt-6 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <RiCheckLine className="size-4 shrink-0 text-primary" />
                    <span>Direct farm pricing</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RiCheckLine className="size-4 shrink-0 text-primary" />
                    <span>Verified local growers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RiCheckLine className="size-4 shrink-0 text-primary" />
                    <span>Flexible fulfillment</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Framed Editorial Agricultural Image */}
              <div className="w-full">
                <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
                  <div className="overflow-hidden rounded-2xl border border-border/80 bg-card p-1.5 shadow-md shadow-muted/50">
                    <div className="overflow-hidden rounded-xl bg-muted">
                      <Image
                        src="/hero-farm.jpg"
                        alt="Local farmer harvesting fresh greens in Butuan at sunrise"
                        width={1024}
                        height={576}
                        priority
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 560px"
                        className="h-auto w-full object-cover object-center"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between px-1 text-xs text-muted-foreground">
                    <span>Butuan City, Agusan del Norte</span>
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <span className="inline-block size-2 rounded-full bg-emerald-600" />
                      Direct farm harvest
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -- 2. Value strip ---------------------------------------- */}
        <section className="border-y border-border/70 bg-muted/25">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-7 sm:py-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {[
                {
                  label: "Local Produce",
                  sub: "Directly from Butuan farms",
                  icon: RiPlantLine,
                },
                {
                  label: "Direct Connections",
                  sub: "No middlemen, transparent prices",
                  icon: RiShoppingBagLine,
                },
                {
                  label: "Fair Opportunities",
                  sub: "Equal market access for growers",
                  icon: RiShieldCheckLine,
                },
                {
                  label: "Reliable Supply",
                  sub: "Scheduled pickup and local delivery",
                  icon: RiTruckLine,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. How UMA works ────────────────────────────────────── */}
        <section id="how" className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24 lg:py-28">
          <div className="mb-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Simple Wholesale Workflow
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              How UMA works
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
              Three straightforward steps connecting local agricultural supply with commercial demand.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3 lg:gap-8">
            {[
              {
                step: "01",
                icon: RiSearchLine,
                title: "Discover",
                description:
                  "Browse fresh produce listings from verified Butuan farmers. Filter by category, price, and current harvest availability.",
              },
              {
                step: "02",
                icon: RiShoppingBagLine,
                title: "Order",
                description:
                  "Place wholesale orders directly with the grower. Choose between direct farm pickup or seller delivery to your premises.",
              },
              {
                step: "03",
                icon: RiTruckLine,
                title: "Fulfill",
                description:
                  "Coordinate seamlessly through threaded order chat. Track status updates from acceptance through fulfillment.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs transition-colors hover:border-border"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <item.icon className="size-5" />
                    </div>
                    <span className="text-xs font-bold tracking-widest text-muted-foreground/80">
                      STEP {item.step}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. For Farmers / For Businesses ─────────────────────── */}
        <section className="border-t border-border/70 bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24 lg:py-28">
            <div className="mb-14 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Two-Sided Agricultural Market
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Built for local growers and commercial buyers
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                Whether you harvest crops or supply commercial kitchens, UMA gives you direct control without middlemen.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
              {/* For Farmers */}
              <div
                id="farmers"
                className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-8 sm:p-10 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <RiPlantLine className="size-6" />
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Growers & Producers
                    </span>
                  </div>

                  <h3 className="mt-6 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    For Farmers
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    List your produce, manage your availability, and receive wholesale orders
                    from local businesses — directly, fairly, and without intermediary markups.
                  </p>

                  <ul className="mt-6 flex flex-col gap-3">
                    {[
                      "Manage your product listings and harvest schedules",
                      "Set your own wholesale prices and minimum quantities",
                      "Receive and fulfill orders directly from verified buyers",
                      "Direct messaging to coordinate pickup or delivery",
                      "Build recurring relationships with local restaurants and stores",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                        <RiCheckLine className="size-4.5 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-border/60">
                  {isAuthenticated && role === "farmer" ? (
                    <Link
                      href="/farmer"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                    >
                      Go to Farmer Dashboard
                      <RiArrowRightLine className="size-4" />
                    </Link>
                  ) : (
                    <Link
                      href="/sign-up"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                    >
                      Sell on UMA
                      <RiArrowRightLine className="size-4" />
                    </Link>
                  )}
                </div>
              </div>

              {/* For Businesses */}
              <div
                id="businesses"
                className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-8 sm:p-10 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <RiBuildingLine className="size-6" />
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Commercial Buyers
                    </span>
                  </div>

                  <h3 className="mt-6 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    For Businesses
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Find fresh, locally grown produce for your restaurant, catering service,
                    or retail market. Order in volume straight from the growers.
                  </p>

                  <ul className="mt-6 flex flex-col gap-3">
                    {[
                      "Browse verified local Butuan farms and crop listings",
                      "Check real-time stock availability and harvest windows",
                      "Place wholesale orders with flexible fulfillment options",
                      "Direct order-threaded communication with farmers",
                      "Support the Butuan City agricultural economy",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                        <RiCheckLine className="size-4.5 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-border/60">
                  {isAuthenticated && role === "business" ? (
                    <Link
                      href="/business"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                    >
                      Go to Business Dashboard
                      <RiArrowRightLine className="size-4" />
                    </Link>
                  ) : (
                    <Link
                      href="/sign-up"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                    >
                      Start sourcing
                      <RiArrowRightLine className="size-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Final CTA ─────────────────────────────────────────── */}
        <section className="border-t border-border/70 bg-background">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Strengthen Your Supply Chain
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Join the growing network of Butuan farmers and commercial buyers
              building a stronger, direct, and more transparent local food system.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
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
                    Create your account
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

      {/* ── 6. Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border/70 bg-muted/25">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <RiPlantLine className="size-3.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground">
                {APP_NAME}
              </span>
              <span className="text-muted-foreground/50">·</span>
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

          <div className="mt-6 border-t border-border/50 pt-6 text-center text-xs text-muted-foreground">
            <p>
              &copy; {new Date().getFullYear()} {APP_NAME}. A localized agricultural marketplace for Butuan City.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

