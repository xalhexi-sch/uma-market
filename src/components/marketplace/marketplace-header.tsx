import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { MarketplaceUserButton } from "./marketplace-user-button";
import { RiShoppingCart2Line, RiArrowRightLine } from "@remixicon/react";
import { APP_NAME } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import { routes, getActiveBusinessIdentity } from "@/platform";
import { MarketplaceMobileNav } from "./marketplace-mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export async function MarketplaceHeader({ activeRoute }: { activeRoute?: string }) {
  const { isAuthenticated, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  const dashboardHref = isAuthenticated ? routes.dashboardRoot : "/onboarding";
  const isBusiness = role === "business";

  const activeBusiness = isAuthenticated ? await getActiveBusinessIdentity() : null;

  const navLinks = [
    { label: "Market", href: "/products", isActive: activeRoute === "products" },
    { label: "How it works", href: "/#how" },
    { label: "For growers", href: "/#growers" },
    { label: "About", href: "/about", isActive: activeRoute === "about" },
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
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              {activeBusiness && (
                <div
                  data-testid="header-active-business"
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-foreground"
                  aria-label={`Operating as ${activeBusiness.name}, ${activeBusiness.role}`}
                >
                  <span className="text-sm select-none" aria-hidden="true">
                    {activeBusiness.canSell ? "🌱" : "🏢"}
                  </span>
                  <div className="flex flex-col min-w-0 max-w-[150px]">
                    <span className="truncate font-semibold text-xs leading-tight">
                      {activeBusiness.name}
                    </span>
                    <div className="flex items-center gap-1 leading-none mt-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {activeBusiness.role}
                      </span>
                      <span className="text-muted-foreground/40 text-[9px]" aria-hidden="true">•</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {activeBusiness.canBuy && activeBusiness.canSell
                          ? "Buy & Sell"
                          : activeBusiness.canSell
                          ? "Producer"
                          : "Buyer"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {isBusiness && (
                <Link
                  href={routes.cart}
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
              <MarketplaceUserButton />
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
                href="/sign-up"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
              >
                Get Started
                <RiArrowRightLine className="size-3.5" />
              </Link>

            </>
          )}
        </div>

        {/* Mobile Nav Toggle */}
        <div className="flex items-center gap-2 sm:hidden">
          {activeBusiness && (
            <div
              data-testid="header-mobile-active-business"
              className="flex items-center gap-1.5 max-w-[130px] rounded-md bg-muted/40 border border-border/50 px-2 py-0.5 text-xs text-foreground"
              aria-label={`Operating as ${activeBusiness.name}, ${activeBusiness.role}`}
            >
              <span className="text-xs shrink-0 select-none" aria-hidden="true">
                {activeBusiness.canSell ? "🌱" : "🏢"}
              </span>
              <span className="truncate text-[11px] font-semibold">{activeBusiness.name}</span>
            </div>
          )}
          <ThemeToggle />
          {isAuthenticated && <MarketplaceUserButton />}
          <MarketplaceMobileNav
            isAuthenticated={!!isAuthenticated}
            dashboardHref={dashboardHref}
            isBusiness={isBusiness}
            activeRoute={activeRoute}
            activeBusiness={activeBusiness}
          />
        </div>
      </div>
    </header>
  );
}
