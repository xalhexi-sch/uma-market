import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RiInformationLine } from "@remixicon/react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardMobileNav } from "@/components/dashboard/mobile-nav";
import type { UserRole } from "@/lib/constants";
import { getCartItemCount } from "@/lib/supabase/queries/cart";
import { getProfileByClerkId } from "@/lib/supabase/queries/profiles";
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

  // Fetch operational counts and check profile completeness
  let cartCount = 0;
  let farmerPendingCount = 0;
  let businessActiveOrderCount = 0;
  let profileMissing = false;

  if (role === "business") {
    const [cCount, oCount, profile] = await Promise.all([
      getCartItemCount(userId),
      getBusinessActiveOrderCount(userId),
      getProfileByClerkId(userId),
    ]);
    if (profile?.status && profile.status !== "active") {
      redirect("/sign-in?revoked=true");
    }
    cartCount = cCount;
    businessActiveOrderCount = oCount;
    profileMissing = !profile;
  } else if (role === "farmer") {
    const [fCount, profile] = await Promise.all([
      getFarmerPendingOrderCount(userId),
      getProfileByClerkId(userId),
    ]);
    if (profile?.status && profile.status !== "active") {
      redirect("/sign-in?revoked=true");
    }
    farmerPendingCount = fCount;
    profileMissing = !profile;
  } else if (role === "admin") {
    const profile = await getProfileByClerkId(userId);
    if (profile?.status && profile.status !== "active") {
      redirect("/sign-in?revoked=true");
    }
    profileMissing = !profile;
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
        {profileMissing && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <RiInformationLine className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Your profile is incomplete. Set up your details to start trading on UMA Market.
              </span>
            </div>
            <Link
              href={`/${role}/profile`}
              className="font-medium underline hover:text-amber-950 dark:hover:text-amber-100 shrink-0"
            >
              Complete Profile →
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
