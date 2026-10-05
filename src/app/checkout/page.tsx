import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiShoppingCart2Line,
  RiBuildingLine,
  RiStore2Line,
  RiArrowLeftLine,
  RiArrowRightLine,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { V4CartContextBar } from "@/components/cart/v4-cart-context-bar";
import { V4CheckoutForm } from "@/components/checkout/v4-checkout-form";
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
  title: "Checkout — UMA Market",
  description: "Review and place your wholesale agricultural order.",
};

export const dynamic = "force-dynamic";

export default async function V4CheckoutPage() {
  let context: ActiveBusinessContext;

  try {
    context = await requireActiveBusiness();
  } catch (error: unknown) {
    if (error instanceof AppError) {
      if (error.code === "UNAUTHENTICATED") {
        redirect(`/sign-in?redirect_url=${encodeURIComponent(routes.checkout)}`);
      }
      if (error.code === "ACCOUNT_INACTIVE") {
        redirect(routes.onboarding);
      }
      if (error.code === "UNAUTHORIZED" && error.message.includes("No active business")) {
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
                    Checkout is available for registered business accounts. Please set up or join a business to purchase produce.
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

  // SELL-only business cannot checkout
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
                &ldquo;{context.business.name}&rdquo; is configured as a producer account without purchasing privileges. To place orders, please switch to a registered buying business.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex flex-col sm:flex-row items-center gap-3">
              {buyerMembership && (
                <p className="text-xs text-muted-foreground">
                  You can switch to {buyerMembership.business?.name} using the business switcher above.
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

  // Empty cart
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
              <EmptyTitle>Your cart is empty</EmptyTitle>
              <EmptyDescription>
                Add some products to your cart before checking out.
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

  // Group by producer
  const byProducer = cartItems.reduce<Record<string, typeof cartItems>>((acc, item) => {
    const fid = item.product?.farmer_clerk_id ?? "unknown";
    if (!acc[fid]) acc[fid] = [];
    acc[fid].push(item);
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6">
          {/* Context + back link */}
          <div className="flex flex-col gap-4">
            <Link
              href={routes.cart}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <RiArrowLeftLine className="size-3.5" />
              Back to Cart
            </Link>

            <V4CartContextBar
              business={context.business}
              role={context.role}
              memberships={context.memberships}
            />
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Checkout</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your order and choose fulfillment details.
            </p>
          </div>

          {/* Form (includes order summary) */}
          <V4CheckoutForm byProducer={byProducer} businessName={context.business.name} />
        </div>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
