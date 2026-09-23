"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  RiDashboardLine,
  RiPlantLine,
  RiShoppingBagLine,
  RiMessage2Line,
  RiUserLine,
  RiBuildingLine,
  RiStoreLine,
  RiShieldLine,
  RiShoppingCart2Line,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { APP_NAME, type UserRole } from "@/lib/constants";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "cart" | "farmerOrders" | "businessOrders";
}

export const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  farmer: [
    { label: "Dashboard", href: "/farmer", icon: RiDashboardLine },
    { label: "My Products", href: "/farmer/products", icon: RiPlantLine },
    { label: "Orders", href: "/farmer/orders", icon: RiShoppingBagLine, badgeKey: "farmerOrders" },
    { label: "Messages", href: "/farmer/messages", icon: RiMessage2Line },
    { label: "Profile", href: "/farmer/profile", icon: RiUserLine },
  ],
  business: [
    { label: "Dashboard", href: "/business", icon: RiDashboardLine },
    { label: "Products", href: "/business/products", icon: RiStoreLine },
    { label: "Cart", href: "/business/cart", icon: RiShoppingCart2Line, badgeKey: "cart" },
    { label: "Orders", href: "/business/orders", icon: RiShoppingBagLine, badgeKey: "businessOrders" },
    { label: "Messages", href: "/business/messages", icon: RiMessage2Line },
    { label: "Profile", href: "/business/profile", icon: RiUserLine },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: RiDashboardLine },
    { label: "Farmers", href: "/admin/farmers", icon: RiPlantLine },
    { label: "Businesses", href: "/admin/businesses", icon: RiBuildingLine },
    { label: "Products", href: "/admin/products", icon: RiStoreLine },
    { label: "Orders", href: "/admin/orders", icon: RiShoppingBagLine },
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  farmer: "Farmer",
  business: "Business",
  admin: "Admin",
};

interface DashboardSidebarProps {
  role: UserRole;
  userId: string;
  cartCount?: number;
  farmerPendingCount?: number;
  businessActiveOrderCount?: number;
}

export function DashboardSidebar({
  role,
  cartCount = 0,
  farmerPendingCount = 0,
  businessActiveOrderCount = 0,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const navItems = NAV_ITEMS[role];

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <RiShieldLine className="size-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground leading-none">{APP_NAME}</p>
          <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{ROLE_LABELS[role]}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-0.5">
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
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
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
      </nav>

      {/* Footer */}
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
    </aside>
  );
}
