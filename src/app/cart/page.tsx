import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  RiShoppingCart2Line,
  RiBuildingLine,
  RiStore2Line,
  RiArrowRightLine,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { V4CartView } from "@/components/cart/v4-cart-view";
import { V4CartContextBar } from "@/components/cart/v4-cart-context-bar";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireActiveBusiness } from "@/platform";
import type { ActiveBusinessContext } from "@/platform";
import { getBusinessCartItems } from "@/lib/supabase/queries/cart";
import { routes } from "@/platform/routes";
import { AppError } from "@/platform/errors";

export const metadata: Metadata = {
  title: "Shopping Cart — UMA Market",
  description: "View and manage wholesale agricultural produce in your business cart.",
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  let context: ActiveBusinessContext;

  try {
    context = await requireActiveBusiness();
  } catch (error: unknown) {
    if (error instanceof AppError) {
      if (error.code === "UNAUTHENTICATED") {
        redirect(`/sign-in?redirect_url=${encodeURIComponent(routes.cart)}`);
      }
      if (error.code === "ACCOUNT_INACTIVE") {
        redirect(routes.onboarding);
      }
      if (error.code === "UNAUTHORIZED" && error.message.includes("No active business")) {
        // Authenticated user with no associated business membership
        return (
          <div className="flex min-h-screen flex-col bg-background">
            <MarketplaceHeader />
            <main className="flex-1 mx-auto flex w-full max-w-5xl items-center justify-center px-4 py-12 sm:px-6">
              <Empty data-testid="no-business-state" className="max-w-md">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <RiBuildingLine className="size-6 text-muted-foreground" aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No Active Business Found</EmptyTitle>
                  <EmptyDescription>
                    The UMA wholesale cart is scoped to registered business accounts. Please set up or join a business organization to purchase produce.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Link
                    href={routes.onboarding}
                    className={buttonVariants({ size: "default" })}
                  >
                    Complete Business Setup
                    <RiArrowRightLine className="ml-1.5 size-4" aria-hidden="true" />
                  </Link>
                </EmptyContent>
              </Empty>
            </main>
            <MarketplaceFooter />
          </div>
        );
      }
    }
    throw error;
  }

  // Handle business exists but cannot buy (e.g. SELL-only producer account)
  if (!context.canBuy) {
    const buyerMembership = context.memberships.find((m) => m.business?.can_buy);

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <MarketplaceHeader />
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 flex flex-col gap-6">
          <V4CartContextBar
            business={context.business}
            role={context.role}
            memberships={context.memberships}
          />
          <Empty data-testid="cannot-buy-state" className="my-8 max-w-lg mx-auto">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RiStore2Line className="size-6 text-muted-foreground" aria-hidden="true" />
              </EmptyMedia>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Seller Account</Badge>
                <span className="text-xs text-muted-foreground">{context.business.name}</span>
              </div>
              <EmptyTitle>Purchasing Unavailable</EmptyTitle>
              <EmptyDescription>
                &ldquo;{context.business.name}&rdquo; is configured as a producer or seller account without purchasing privileges. To place orders, please switch to a registered buying organization.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex flex-col sm:flex-row items-center gap-3">
              {buyerMembership && (
                <p className="text-xs text-muted-foreground">
                  You can switch to {buyerMembership.business?.name} using the organization switcher above.
                </p>
              )}
              <Link
                href={routes.products}
                className={buttonVariants({ variant: "outline" })}
              >
                Browse Marketplace
              </Link>
            </EmptyContent>
          </Empty>
        </main>
        <MarketplaceFooter />
      </div>
    );
  }

  // Fetch business cart items
  const cartItems = await getBusinessCartItems(context.business.id);

  // Handle empty cart state
  if (cartItems.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <MarketplaceHeader />
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 flex flex-col gap-6">
          <V4CartContextBar
            business={context.business}
            role={context.role}
            memberships={context.memberships}
          />
          <Empty data-testid="empty-cart-state" className="my-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RiShoppingCart2Line className="size-6 text-muted-foreground" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Your business cart is empty</EmptyTitle>
              <EmptyDescription>
                Your team hasn&apos;t added any produce to {context.business.name}&apos;s cart yet. Explore fresh harvests from verified local producers.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link
                href={routes.products}
                data-testid="browse-products-link"
                className={buttonVariants({ size: "lg" })}
              >
                Explore Products
                <RiArrowRightLine className="ml-2 size-4" aria-hidden="true" />
              </Link>
            </EmptyContent>
          </Empty>
        </main>
        <MarketplaceFooter />
      </div>
    );
  }

  // Normal populated cart
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <V4CartView context={context} items={cartItems} />
      </main>
      <MarketplaceFooter />
    </div>
  );
}
