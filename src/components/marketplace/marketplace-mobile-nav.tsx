"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RiMenuLine, RiShoppingCart2Line, RiArrowRightLine, RiPlantLine, RiBuildingLine } from "@remixicon/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APP_NAME } from "@/lib/constants";
import { ThemeToggle } from "@/components/theme-toggle";
import { routes } from "@/platform/routes";
import { cn } from "@/lib/utils";

import type { ActiveBusinessIdentity } from "@/platform";

interface MarketplaceMobileNavProps {
  isAuthenticated: boolean;
  dashboardHref: string;
  isBusiness: boolean;
  activeRoute?: string;
  activeBusiness?: ActiveBusinessIdentity | null;
}

export function MarketplaceMobileNav({
  isAuthenticated,
  dashboardHref,
  isBusiness,
  activeRoute,
  activeBusiness,
}: MarketplaceMobileNavProps) {
  const [open, setOpen] = useState(false);

  const navLinks = [
    { label: "Market", href: "/products", isActive: activeRoute === "products" },
    { label: "How it works", href: "/#how" },
    { label: "For growers", href: "/#growers" },
    { label: "About", href: "/about", isActive: activeRoute === "about" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-muted/50"
        aria-label="Open menu"
      >
        <RiMenuLine className="size-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[300px] p-0 flex flex-col justify-between">
        <div className="p-6">
          <SheetHeader className="flex flex-row items-center justify-between pb-6 border-b border-border/60">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5"
            >
              <Image
                src="/brand/icon/uma-icon-512.png"
                alt="UMA Market"
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg shadow-xs shrink-0"
              />
              <SheetTitle className="text-base font-bold tracking-tight text-foreground">
                {APP_NAME}
              </SheetTitle>
            </Link>
          </SheetHeader>

          {/* Active Business Identity inside Drawer */}
          {activeBusiness && (
            <div
              data-testid="marketplace-mobile-drawer-active-business"
              className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3.5"
              aria-label={`Operating as ${activeBusiness.name}, ${activeBusiness.role}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    activeBusiness.canSell
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-primary/10 text-primary"
                  )}
                  aria-hidden="true"
                >
                  {activeBusiness.canSell ? (
                    <RiPlantLine className="size-4" />
                  ) : (
                    <RiBuildingLine className="size-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-xs font-semibold text-foreground leading-tight"
                    title={activeBusiness.name}
                  >
                    {activeBusiness.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wider">
                      {activeBusiness.role}
                    </span>
                    <span className="text-muted-foreground/40" aria-hidden="true">•</span>
                    <span className="truncate">
                      {activeBusiness.canBuy && activeBusiness.canSell
                        ? "Buy & Sell"
                        : activeBusiness.canSell
                        ? "Producer"
                        : "Buyer"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nav links */}
          <nav className="mt-6 flex flex-col gap-2">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  item.isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Footer CTAs */}
        <div className="p-6 border-t border-border/60 flex flex-col gap-3">
          <div className="flex items-center justify-between py-1 px-1">
            <span className="text-xs font-medium text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          {isAuthenticated ? (
            <>
              {isBusiness && (
                <Link
                  href={routes.cart}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-md border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  <RiShoppingCart2Line className="size-4" />
                  View Cart
                </Link>
              )}
              <Link
                href={dashboardHref}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-xs"
              >
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-up"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
              >
                Get Started
                <RiArrowRightLine className="size-4" />
              </Link>
              <Link
                href="/sign-in"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-md border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
