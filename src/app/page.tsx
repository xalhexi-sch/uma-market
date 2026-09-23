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
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <RiPlantLine className="size-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              {APP_NAME}
            </span>
          </Link>

          {/* Center nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {[
              { label: "Products", href: "#products" },
              { label: "For Farmers", href: "#farmers" },
              { label: "For Businesses", href: "#businesses" },
              { label: "How it works", href: "#how" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
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
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Background image */}
          <div className="absolute inset-0 -z-10">
            <Image
              src="/hero-farm.jpg"
              alt="Lush farm fields in Butuan at golden hour"
              fill
              className="object-cover object-center"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          </div>

          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 md:py-36">
            <div className="max-w-xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">
                Butuan City · Agricultural Marketplace
              </p>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Fresh from Butuan&apos;s farms<br />
                to your business.
              </h1>
              <p className="mt-5 text-base text-muted-foreground sm:text-lg">
                Source local produce, check availability, and manage orders
                in one place — directly from the farmers who grow it.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {isAuthenticated ? (
                  <Link
                    href={dashboardHref}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    Go to Dashboard
                    <RiArrowRightLine className="size-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/sign-up"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    >
                      Explore products
                      <RiArrowRightLine className="size-4" />
                    </Link>
                    <Link
                      href="#farmers"
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background/80 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      Sell on UMA
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Value strip ─────────────────────────────────────────── */}
        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-border px-6 py-8 sm:grid-cols-4">
            {[
              { label: "Local Produce", sub: "Directly from Butuan farms" },
              { label: "Direct Connections", sub: "No middlemen, fair prices" },
              { label: "Fair Opportunities", sub: "Equal access for all farmers" },
              { label: "Stronger Communities", sub: "Supporting local livelihoods" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-1 px-4 py-2 first:pl-0 last:pr-0">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────── */}
        <section id="how" className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              How UMA works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three steps. That&apos;s all it takes.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                icon: <RiSearchLine className="size-7 text-primary" />,
                title: "Discover",
                description:
                  "Browse fresh produce listings from verified Butuan farmers. Filter by category, price, and availability.",
              },
              {
                step: "02",
                icon: <RiShoppingBagLine className="size-7 text-primary" />,
                title: "Order",
                description:
                  "Place an order directly with the farmer. Choose pickup or seller delivery for your business.",
              },
              {
                step: "03",
                icon: <RiTruckLine className="size-7 text-primary" />,
                title: "Fulfill",
                description:
                  "Track order status from acceptance to delivery. Both sides stay informed throughout.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  {item.icon}
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-muted-foreground">
                    STEP {item.step}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Two-sided value ─────────────────────────────────────── */}
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="grid gap-16 md:grid-cols-2">
              {/* For Farmers */}
              <div id="farmers">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                  <RiPlantLine className="size-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  For Farmers
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  List your produce, manage your availability, and receive
                  orders from local businesses — all without a middleman.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {[
                    "Manage your product listings",
                    "Set your own prices and quantities",
                    "Receive and fulfill orders directly",
                    "Track order status and payments",
                    "Build direct relationships with buyers",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                      <RiCheckLine className="size-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className="mt-7 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Sell on UMA
                  <RiArrowRightLine className="size-4" />
                </Link>
              </div>

              {/* For Businesses */}
              <div id="businesses">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                  <RiBuildingLine className="size-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  For Businesses
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Find fresh, locally grown produce for your restaurant,
                  catering business, or store. Order directly from the source.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {[
                    "Browse verified local farmers",
                    "Check real-time product availability",
                    "Place orders with flexible fulfillment",
                    "Track from order to delivery",
                    "Support the local Butuan economy",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                      <RiCheckLine className="size-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className="mt-7 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Start sourcing
                  <RiArrowRightLine className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-24 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Join the growing network of Butuan farmers and businesses
              building a stronger local food supply chain.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {isAuthenticated ? (
                <Link
                  href={dashboardHref}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Open Dashboard
                  <RiArrowRightLine className="size-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
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

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-3 px-6 py-6 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary">
              <RiPlantLine className="size-3 text-primary-foreground" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {APP_NAME}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            A localized agricultural marketplace for Butuan City.
          </p>
        </div>
      </footer>
    </div>
  );
}
