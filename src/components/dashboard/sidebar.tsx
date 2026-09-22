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
  RiFileListLine,
  RiCheckboxCircleLine,
  RiShoppingCart2Line,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { APP_NAME, type UserRole } from "@/lib/constants";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "cart"; // which badge to show
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  farmer: [
    { label: "Dashboard", href: "/farmer", icon: RiDashboardLine },
    { label: "My Products", href: "/farmer/products", icon: RiPlantLine },
    { label: "Orders", href: "/farmer/orders", icon: RiShoppingBagLine },
    { label: "Messages", href: "/farmer/messages", icon: RiMessage2Line },
    { label: "Profile", href: "/farmer/profile", icon: RiUserLine },
  ],
  business: [
    { label: "Dashboard", href: "/business", icon: RiDashboardLine },
    { label: "Products", href: "/business/products", icon: RiStoreLine },
    { label: "Cart", href: "/business/cart", icon: RiShoppingCart2Line, badgeKey: "cart" },
    { label: "Orders", href: "/business/orders", icon: RiShoppingBagLine },
    { label: "Messages", href: "/business/messages", icon: RiMessage2Line },
    { label: "Profile", href: "/business/profile", icon: RiUserLine },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: RiDashboardLine },
    { label: "Farmers", href: "/admin/farmers", icon: RiPlantLine },
    { label: "Businesses", href: "/admin/businesses", icon: RiBuildingLine },
    { label: "Products", href: "/admin/products", icon: RiStoreLine },
    { label: "Orders", href: "/admin/orders", icon: RiShoppingBagLine },
    { label: "Verification", href: "/admin/verification", icon: RiCheckboxCircleLine },
    { label: "Reports", href: "/admin/reports", icon: RiFileListLine },
  ],
};

const ROLE_LABELS: Record<UserRole, string> = {
  farmer: "Farmer",
  business: "Business",
  admin: "Admin",
};

interface DashboardSidebarProps {
  role: UserRole;
  userId: string;
  cartCount?: number;
}

export function DashboardSidebar({ role, cartCount = 0 }: DashboardSidebarProps) {
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
            const badge = item.badgeKey === "cart" && cartCount > 0 ? cartCount : null;
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
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
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
