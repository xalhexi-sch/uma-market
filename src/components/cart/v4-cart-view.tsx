"use client";

import Link from "next/link";
import {
  RiShoppingBagLine,
  RiArrowRightLine,
  RiStore2Line,
  RiCheckboxCircleFill,
  RiShieldCheckLine,
  RiAlertLine,
} from "@remixicon/react";
import { V4CartContextBar } from "./v4-cart-context-bar";
import { V4CartItemRow } from "./v4-cart-item-row";
import { buttonVariants } from "@/components/ui/button";
import { CURRENCY } from "@/lib/constants";
import { routes } from "@/platform/routes";
import type { CartItem } from "@/lib/types";
import type { ActiveBusinessContext } from "@/platform";

interface V4CartViewProps {
  context: ActiveBusinessContext;
  items: CartItem[];
}

export function V4CartView({ context, items }: V4CartViewProps) {
  // Group items by producer
  const byProducer = items.reduce<Record<string, CartItem[]>>((acc, item) => {
    const pid = item.product?.farmer_clerk_id || "unspecified";
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(item);
    return acc;
  }, {});

  const producerCount = Object.keys(byProducer).length;

  const grandTotal = items.reduce((sum, item) => {
    const price = item.product?.price_per_unit || 0;
    return sum + price * item.quantity;
  }, 0);

  // Check if any items have invalid/unavailable states
  const hasInvalidItems = items.some((item) => {
    if (!item.product) return true;
    const stock = item.product.quantity_available ?? 0;
    const isInactive = item.product.status !== "active";
    const isOutOfStock = stock <= 0;
    const isBelowMoq = stock < (item.product.min_order_quantity || 1);
    const exceedsStock = item.quantity > stock;
    return isInactive || isOutOfStock || isBelowMoq || exceedsStock;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Active Business Context Bar */}
      <V4CartContextBar
        business={context.business}
        role={context.role}
        memberships={context.memberships}
      />

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Main Cart Items Column */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Shopping Cart
            </h1>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "item" : "items"} from {producerCount}{" "}
              {producerCount === 1 ? "producer" : "producers"}
            </span>
          </div>

          <div className="flex flex-col gap-6">
            {Object.entries(byProducer).map(([producerId, producerItems]) => {
              const farmer = producerItems[0]?.product?.farmer;
              const producerName =
                farmer?.business_name || farmer?.full_name || "Local Agricultural Producer";
              const producerCity = farmer?.city || "Butuan City";
              const isVerified = Boolean(farmer?.is_verified);

              const producerSubtotal = producerItems.reduce((sum, item) => {
                const price = item.product?.price_per_unit || 0;
                return sum + price * item.quantity;
              }, 0);

              const producerProfileHref = farmer?.clerk_id
                ? routes.producer(farmer.clerk_id)
                : routes.producers;

              return (
                <div
                  key={producerId}
                  data-testid={`producer-group-${producerId}`}
                  className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs"
                >
                  {/* Producer Group Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <RiStore2Line className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <Link
                        href={producerProfileHref}
                        className="font-medium text-sm text-foreground hover:text-primary transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
                      >
                        {producerName}
                      </Link>
                      {isVerified && (
                        <span title="Verified Producer" aria-label="Verified Producer">
                          <RiCheckboxCircleFill className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">· {producerCity}</span>
                    </div>

                    <div className="text-xs sm:text-sm text-muted-foreground">
                      Subtotal:{" "}
                      <span className="font-semibold text-foreground">
                        {CURRENCY}
                        {producerSubtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Items for this producer */}
                  <div className="divide-y divide-border">
                    {producerItems.map((item) => (
                      <V4CartItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar / Checkout Summary */}
        <div className="lg:col-span-4 lg:sticky lg:top-24">
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs flex flex-col gap-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Cart Summary</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Wholesale pricing direct from verified farms
              </p>
            </div>

            <div className="divide-y divide-border/60 text-sm">
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Items Total</span>
                <span className="font-medium tabular-nums text-foreground">
                  {CURRENCY}
                  {grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Platform Fees</span>
                <span className="font-medium text-primary">None</span>
              </div>
              <div className="flex items-center justify-between pt-3">
                <span className="text-base font-semibold text-foreground">Subtotal</span>
                <span className="text-xl font-bold tabular-nums text-foreground">
                  {CURRENCY}
                  {grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {hasInvalidItems && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <RiAlertLine className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  One or more items in your cart are out of stock or exceed available quantities. Please adjust before checking out.
                </span>
              </div>
            )}

            {producerCount > 1 && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Contains harvests from {producerCount} producers. Separate orders will be created per producer at checkout.
              </p>
            )}

            {hasInvalidItems ? (
              <button
                type="button"
                disabled
                className={buttonVariants({
                  size: "lg",
                  className: "w-full justify-center opacity-50 cursor-not-allowed",
                })}
              >
                <RiShoppingBagLine className="size-4 mr-2" aria-hidden="true" />
                Proceed to Checkout
              </button>
            ) : (
              <Link
                href={routes.checkout}
                data-testid="checkout-cta"
                className={buttonVariants({
                  size: "lg",
                  className: "w-full justify-center",
                })}
              >
                <RiShoppingBagLine className="size-4 mr-2" aria-hidden="true" />
                Proceed to Checkout
                <RiArrowRightLine className="size-4 ml-1.5" aria-hidden="true" />
              </Link>
            )}

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
              <RiShieldCheckLine className="size-3.5 text-primary" aria-hidden="true" />
              <span>Direct farmer-to-business transaction</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
