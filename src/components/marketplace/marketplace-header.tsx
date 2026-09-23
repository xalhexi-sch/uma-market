import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { RiShoppingCart2Line, RiArrowRightLine } from "@remixicon/react";
import { APP_NAME } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import { MarketplaceMobileNav } from "./marketplace-mobile-nav";

export async function MarketplaceHeader({ activeRoute }: { activeRoute?: string }) {
  const { isAuthenticated, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  const dashboardHref = role ? `/${role}` : "/onboarding";
  const isBusiness = role === "business";

  const navLinks = [
    { label: "Market", href: "/products", isActive: activeRoute === "products" },
    { label: "How it works", href: "/#how" },
    { label: "For growers", href: "/#growers" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/brand/icon/uma-icon-512.png"
            alt="UMA Market"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg shadow-xs shrink-0 transition-transform group-hover:scale-105"
            priority
          />
          <span className="text-base font-bold tracking-tight text-foreground">
            {APP_NAME}
          </span>
        </Link>

        {/* Center Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors hover:text-foreground ${
                item.isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Auth CTAs */}
        <div className="hidden items-center gap-3 sm:flex">
          {isAuthenticated ? (
            <>
              {isBusiness && (
                <Link
                  href="/business/cart"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  title="View Shopping Cart"
                >
                  <RiShoppingCart2Line className="size-4" />
                </Link>
              )}
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
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
              >
                Explore the market
                <RiArrowRightLine className="size-3.5" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Nav Toggle */}
        <div className="flex items-center gap-2 sm:hidden">
          {isAuthenticated && <UserButton />}
          <MarketplaceMobileNav
            isAuthenticated={!!isAuthenticated}
            dashboardHref={dashboardHref}
            isBusiness={isBusiness}
            activeRoute={activeRoute}
          />
        </div>
      </div>
    </header>
  );
}
