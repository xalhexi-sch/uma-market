"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RiMenuLine, RiShoppingCart2Line, RiArrowRightLine } from "@remixicon/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APP_NAME } from "@/lib/constants";
import { ThemeToggle } from "@/components/theme-toggle";

interface MarketplaceMobileNavProps {
  isAuthenticated: boolean;
  dashboardHref: string;
  isBusiness: boolean;
  activeRoute?: string;
}

export function MarketplaceMobileNav({
  isAuthenticated,
  dashboardHref,
  isBusiness,
  activeRoute,
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
                  href="/business/cart"
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
