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
  RiDashboardLine,
  RiPlantLine,
  RiShoppingBagLine,
  RiMessage2Line,
  RiUserLine,
  RiStoreLine,
  RiBuildingLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NAV_ITEMS, ROLE_LABELS, type ActiveBusinessIdentity } from "@/components/dashboard/sidebar";
import { APP_NAME, type UserRole } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { routes } from "@/platform/routes";

const BOTTOM_NAV_ITEMS: Record<
  UserRole,
  Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeKey?: "cart" | "farmerOrders" | "businessOrders";
  }>
> = {
  farmer: [
    { label: "Home", href: "/farmer", icon: RiDashboardLine },
    { label: "Products", href: "/farmer/products", icon: RiPlantLine },
    { label: "Orders", href: "/farmer/orders", icon: RiShoppingBagLine, badgeKey: "farmerOrders" },
    { label: "Messages", href: "/farmer/messages", icon: RiMessage2Line },
    { label: "Profile", href: routes.dashboard.profile, icon: RiUserLine },
  ],
  // Canonical V4 buyer routes. The legacy /business/* tree only redirects here.
  business: [
    { label: "Home", href: routes.dashboardRoot, icon: RiDashboardLine },
    { label: "Products", href: routes.products, icon: RiStoreLine },
    { label: "Orders", href: routes.orders, icon: RiShoppingBagLine, badgeKey: "businessOrders" },
    { label: "Messages", href: routes.dashboard.messages, icon: RiMessage2Line },
    { label: "Profile", href: routes.dashboard.profile, icon: RiUserLine },
  ],
  admin: [
    { label: "Home", href: "/admin", icon: RiDashboardLine },
    { label: "Farmers", href: "/admin/farmers", icon: RiPlantLine },
    { label: "Businesses", href: "/admin/businesses", icon: RiBuildingLine },
    { label: "Products", href: "/admin/products", icon: RiStoreLine },
    { label: "Orders", href: "/admin/orders", icon: RiShoppingBagLine },
  ],
};

interface DashboardMobileNavProps {
  role: UserRole;
  cartCount?: number;
  farmerPendingCount?: number;
  businessActiveOrderCount?: number;
  activeBusiness?: ActiveBusinessIdentity | null;
}

export function DashboardMobileNav({
  role,
  cartCount = 0,
  farmerPendingCount = 0,
  businessActiveOrderCount = 0,
  activeBusiness,
}: DashboardMobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navItems = NAV_ITEMS[role] ?? [];
  const bottomNavItems = BOTTOM_NAV_ITEMS[role] ?? [];
  // The first nav item is the role's home; it only matches exactly.
  const homeHref = navItems[0]?.href ?? routes.home;

  return (
    <>
      <header className="flex md:hidden h-14 items-center justify-between border-b border-border bg-sidebar px-4 shrink-0 z-40 gap-2">
      {/* Left: Hamburger trigger & Brand */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shrink-0"
        >
          <RiMenuLine className="size-5" />
        </Button>

        <Link
          href={homeHref}
          className="flex items-center gap-2 shrink-0"
          onClick={() => setOpen(false)}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <RiShieldLine className="size-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
            {APP_NAME}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground uppercase tracking-wider hidden sm:inline-block">
            {ROLE_LABELS[role]}
          </span>
        </Link>
      </div>

      {/* Middle/Right: Active business on mobile */}
      {activeBusiness && (
        <div
          data-testid="mobile-header-active-business"
          className="hidden min-[430px]:flex items-center gap-1.5 max-w-[140px] truncate rounded-md bg-sidebar-accent/50 border border-border/50 px-2 py-0.5 text-xs text-sidebar-foreground"
          aria-label={`Operating as ${activeBusiness.name}, ${activeBusiness.role}`}
        >
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-xs",
              activeBusiness.canSell
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-primary"
            )}
            aria-hidden="true"
          >
            {activeBusiness.canSell ? (
              <RiPlantLine className="size-3.5" />
            ) : (
              <RiBuildingLine className="size-3.5" />
            )}
          </span>
          <span className="truncate text-[11px] font-semibold">{activeBusiness.name}</span>
        </div>
      )}

      {/* Right: Quick actions & User Profile */}
      <div className="flex items-center gap-2.5 shrink-0">
        <ThemeToggle />

        {role === "business" && (
          <Link
            href={routes.cart}
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

          {/* Active Business Identity inside Drawer */}
          {activeBusiness && (
            <div
              data-testid="mobile-drawer-active-business"
              className="border-b border-sidebar-border bg-sidebar-accent/20 px-5 py-3"
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
                  <p className="truncate text-xs font-semibold text-sidebar-foreground leading-tight" title={activeBusiness.name}>
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

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col justify-between">
            <ul className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === homeHref
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
          <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <UserButton
                appearance={{
                  elements: {
                    userButtonBox: "flex items-center gap-2",
                    userButtonOuterIdentifier: "text-sm text-sidebar-foreground truncate max-w-[140px]",
                  },
                }}
                showName
              />
            </div>
            <ThemeToggle />
          </div>
        </SheetContent>
      </Sheet>
    </header>

    {/* Mobile Bottom Navigation Bar (< md) */}
    <nav
      aria-label="Mobile bottom navigation"
      className="fixed bottom-0 inset-x-0 z-40 flex md:hidden h-16 border-t border-border bg-sidebar/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] items-stretch justify-around px-1"
    >
      {bottomNavItems.map((item) => {
        const isActive =
          item.href === homeHref
            ? pathname === item.href
            : pathname.startsWith(item.href);

        let badge: number | null = null;
        let badgeVariant: "primary" | "amber" | "emerald" = "primary";

        if (item.badgeKey === "farmerOrders" && farmerPendingCount > 0) {
          badge = farmerPendingCount;
          badgeVariant = "amber";
        } else if (item.badgeKey === "businessOrders" && businessActiveOrderCount > 0) {
          badge = businessActiveOrderCount;
          badgeVariant = "emerald";
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center min-h-[48px] py-1 px-1 transition-colors relative select-none",
              isActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground active:text-foreground"
            )}
          >
            <div className="relative">
              <item.icon className="size-5 shrink-0" />
              {badge !== null && (
                <span
                  className={cn(
                    "absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white",
                    badgeVariant === "primary" && "bg-primary text-primary-foreground",
                    badgeVariant === "amber" && "bg-amber-600",
                    badgeVariant === "emerald" && "bg-emerald-600"
                  )}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-1 leading-none">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  </>
);
}
