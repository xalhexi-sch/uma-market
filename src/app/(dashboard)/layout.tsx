import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardMobileNav } from "@/components/dashboard/mobile-nav";
import type { UserRole } from "@/lib/constants";
import { getCartItemCount } from "@/lib/supabase/queries/cart";
import {
  getFarmerPendingOrderCount,
  getBusinessActiveOrderCount,
} from "@/lib/supabase/queries/orders";

/**
 * Shared layout for all authenticated dashboards.
 *
 * Authorization is resource-level:
 * - Checks authentication here (unauthenticated → /sign-in)
 * - Checks that a role exists (no role → /onboarding)
 * - Role-specific page protection happens in each page/sub-layout
 *
 * No createRouteMatcher() — no middleware route checks.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, sessionClaims, isAuthenticated } = await auth();

  if (!isAuthenticated || !userId) {
    redirect("/sign-in");
  }

  const role = sessionClaims?.user_role as UserRole | undefined;

  // New user hasn't completed onboarding yet
  if (!role) {
    redirect("/onboarding");
  }

  // Fetch operational counts for sidebar badges
  let cartCount = 0;
  let farmerPendingCount = 0;
  let businessActiveOrderCount = 0;

  if (role === "business") {
    const [cCount, oCount] = await Promise.all([
      getCartItemCount(userId),
      getBusinessActiveOrderCount(userId),
    ]);
    cartCount = cCount;
    businessActiveOrderCount = oCount;
  } else if (role === "farmer") {
    farmerPendingCount = await getFarmerPendingOrderCount(userId);
  }

  return (
    <div className="flex h-screen flex-col md:flex-row overflow-hidden bg-background">
      {/* Mobile Topbar & Sheet Drawer (< md) */}
      <DashboardMobileNav
        role={role}
        cartCount={cartCount}
        farmerPendingCount={farmerPendingCount}
        businessActiveOrderCount={businessActiveOrderCount}
      />

      {/* Desktop Sidebar (>= md) */}
      <div className="hidden md:flex h-full shrink-0">
        <DashboardSidebar
          role={role}
          userId={userId}
          cartCount={cartCount}
          farmerPendingCount={farmerPendingCount}
          businessActiveOrderCount={businessActiveOrderCount}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
