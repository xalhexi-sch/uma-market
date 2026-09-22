import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import type { UserRole } from "@/lib/constants";
import { getCartItemCount } from "@/lib/supabase/queries/cart";

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

  // Fetch cart count for business users (drives sidebar badge)
  let cartCount = 0;
  if (role === "business") {
    cartCount = await getCartItemCount(userId);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar role={role} userId={userId} cartCount={cartCount} />
      <main className="flex flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
