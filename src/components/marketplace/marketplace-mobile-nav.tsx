"use client";

import { useState } from "react";
import Link from "next/link";
import { RiMenuLine, RiCloseLine, RiPlantLine, RiShoppingCart2Line } from "@remixicon/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APP_NAME } from "@/lib/constants";

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
    { label: "Products", href: "/products", isActive: activeRoute === "products" },
    { label: "How it works", href: "/#how" },
    { label: "For Farmers", href: "/#farmers" },
    { label: "For Businesses", href: "/#businesses" },
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <RiPlantLine className="size-4.5" />
              </div>
              <SheetTitle className="text-base font-bold tracking-tight text-foreground">
                {APP_NAME}
              </SheetTitle>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close menu"
            >
              <RiCloseLine className="size-5" />
            </button>
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
                href="/sign-in"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-md border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-xs"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
