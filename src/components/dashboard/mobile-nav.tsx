"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  RiMenuLine,
  RiShieldLine,
  RiShoppingCart2Line,
  RiHomeLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NAV_ITEMS, ROLE_LABELS } from "@/components/dashboard/sidebar";
import { APP_NAME, type UserRole } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface DashboardMobileNavProps {
  role: UserRole;
  cartCount?: number;
  farmerPendingCount?: number;
  businessActiveOrderCount?: number;
}

export function DashboardMobileNav({
  role,
  cartCount = 0,
  farmerPendingCount = 0,
  businessActiveOrderCount = 0,
}: DashboardMobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navItems = NAV_ITEMS[role] ?? [];

  return (
    <header className="flex md:hidden h-14 items-center justify-between border-b border-border bg-sidebar px-4 shrink-0 z-40">
      {/* Left: Hamburger trigger & Brand */}
      <div className="flex items-center gap-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <RiMenuLine className="size-5" />
        </Button>

        <Link
          href={`/${role}`}
          className="flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <RiShieldLine className="size-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
            {APP_NAME}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground uppercase tracking-wider">
            {ROLE_LABELS[role]}
          </span>
        </Link>
      </div>

      {/* Right: Quick actions & User Profile */}
      <div className="flex items-center gap-3">
        {role === "business" && (
          <Link
            href="/business/cart"
            className="relative flex items-center justify-center text-sidebar-foreground hover:text-primary transition-colors p-1"
            aria-label={`Shopping Cart (${cartCount} items)`}
          >
            <RiShoppingCart2Line className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        )}

        <div className="flex items-center">
          <UserButton />
        </div>
      </div>

      {/* Slide-over Sheet Navigation Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-72 max-w-[85vw] p-0 flex flex-col bg-sidebar h-full border-r border-border"
        >
          <SheetHeader className="flex h-16 flex-row items-center gap-2 border-b border-border px-5 py-0">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 transition-opacity hover:opacity-90"
              title="Go to UMA Market Home"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <RiShieldLine className="size-4 text-primary-foreground" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold text-sidebar-foreground leading-none">
                  {APP_NAME}
                </SheetTitle>
                <p className="text-[11px] text-muted-foreground leading-none mt-1">
                  {ROLE_LABELS[role]} Dashboard
                </p>
              </div>
            </Link>
          </SheetHeader>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col justify-between">
            <ul className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === `/${role}`
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                let badge: number | null = null;
                let badgeVariant: "primary" | "amber" | "emerald" = "primary";

                if (item.badgeKey === "cart" && cartCount > 0) {
                  badge = cartCount;
                  badgeVariant = "primary";
                } else if (item.badgeKey === "farmerOrders" && farmerPendingCount > 0) {
                  badge = farmerPendingCount;
                  badgeVariant = "amber";
                } else if (item.badgeKey === "businessOrders" && businessActiveOrderCount > 0) {
                  badge = businessActiveOrderCount;
                  badgeVariant = "emerald";
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {badge !== null && (
                        <span
                          className={cn(
                            "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white",
                            badgeVariant === "primary" && "bg-primary text-primary-foreground",
                            badgeVariant === "amber" && "bg-amber-600",
                            badgeVariant === "emerald" && "bg-emerald-600"
                          )}
                        >
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Public Market Link */}
            <div className="mt-auto pt-4 border-t border-border/60">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <RiHomeLine className="size-4 shrink-0" />
                <span className="flex-1">Marketplace Home</span>
              </Link>
            </div>
          </nav>

          {/* Drawer Footer */}
          <div className="border-t border-border px-4 py-3">
            <UserButton
              appearance={{
                elements: {
                  userButtonBox: "flex items-center gap-2",
                  userButtonOuterIdentifier: "text-sm text-sidebar-foreground",
                },
              }}
              showName
            />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
