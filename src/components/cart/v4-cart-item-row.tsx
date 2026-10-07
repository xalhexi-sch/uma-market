"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  RiDeleteBinLine,
  RiSubtractLine,
  RiAddLine,
  RiAlertLine,
  RiInformationLine,
} from "@remixicon/react";
import { updateBusinessCartItemQuantity, removeFromBusinessCart } from "@/platform/cart-actions";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { ProductImage } from "@/components/marketplace/product-image";
import { toast } from "@/components/ui/toast";
import { CURRENCY } from "@/lib/constants";
import { routes } from "@/platform/routes";
import type { CartItem } from "@/lib/types";

interface V4CartItemRowProps {
  item: CartItem;
}

export function V4CartItemRow({ item }: V4CartItemRowProps) {
  const product = item.product;
  const [quantity, setQuantity] = useState(item.quantity);
  const [isPending, startTransition] = useTransition();

  if (!product) {
    return (
      <div className="flex items-center justify-between p-4 bg-muted/20">
        <p className="text-sm text-muted-foreground">Product listing is no longer available.</p>
        <button
          type="button"
          onClick={() => {
            startTransition(async () => {
              const res = await removeFromBusinessCart(item.id);
              if (res.success) toast.success("Removed unavailable item from cart.");
            });
          }}
          disabled={isPending}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove item"
        >
          <RiDeleteBinLine className="size-4" />
        </button>
      </div>
    );
  }

  const unit = product.unit;
  const step = unit === "kg" || unit === "g" ? 0.5 : 1;
  const min = product.min_order_quantity || 1;
  const stock = product.quantity_available ?? 0;
  const isOutOfStock = stock <= 0 || product.status !== "active";
  const isBelowMoq = stock < min;
  const isUnavailable = isOutOfStock || isBelowMoq;
  const isOverStock = !isUnavailable && quantity > stock;

  const lineTotal = quantity * (product.price_per_unit || 0);
  const imageUrl = getProductImageUrl(product.image_path, product.image_url);

  function handleQuantityChange(nextQty: number) {
    if (isUnavailable) return;
    const clamped = Math.max(min, Math.min(stock, +nextQty.toFixed(2)));
    setQuantity(clamped);

    startTransition(async () => {
      const res = await updateBusinessCartItemQuantity(item.id, clamped);
      if (res.success) {
        toast.success(`Quantity updated to ${clamped} ${unit}.`);
      } else {
        setQuantity(item.quantity);
        toast.error(res.error ?? "Could not update quantity.");
      }
    });
  }

  function handleRemove() {
    if (!product) return;
    const productName = product.name;
    startTransition(async () => {
      const res = await removeFromBusinessCart(item.id);
      if (res.success) {
        toast.success(`"${productName}" removed from cart.`);
      } else {
        toast.error(res.error ?? "Could not remove item.");
      }
    });
  }

  return (
    <div
      data-testid={`v4-cart-item-${item.id}`}
      className={`flex flex-col gap-4 p-4 transition-opacity sm:flex-row sm:items-center sm:justify-between ${
        isPending ? "opacity-50" : ""
      }`}
    >
      {/* Product Image & Info */}
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <Link
          href={routes.product(product.id)}
          className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ProductImage
            src={imageUrl}
            alt={product.name}
            className="size-full object-cover"
          />
        </Link>

        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={routes.product(product.id)}
              className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
            >
              {product.name}
            </Link>
            {product.category?.name && (
              <span className="text-[11px] text-muted-foreground">
                ({product.category.name})
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {CURRENCY}
              {product.price_per_unit.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </span>
            {" / "}
            {unit}
          </p>

          {/* Availability / Stock status indicators */}
          {isUnavailable ? (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
              <RiAlertLine className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {isOutOfStock
                  ? "Item is currently unavailable"
                  : `Remaining stock (${stock} ${unit}) is below minimum order (${min} ${unit})`}
              </span>
            </div>
          ) : isOverStock ? (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <RiInformationLine className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Only {stock} {unit} available in stock (quantity exceeds stock).
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              In stock: {stock} {unit} · Min order: {min} {unit}
            </p>
          )}
        </div>
      </div>

      {/* Stepper + Total + Remove */}
      <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t border-border/40 sm:border-0">
        {/* Quantity Controls */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center rounded-lg border border-border bg-background"
            role="group"
            aria-label={`Adjust quantity for ${product.name}`}
          >
            <button
              type="button"
              onClick={() => handleQuantityChange(quantity - step)}
              disabled={quantity <= min || isPending || isUnavailable}
              aria-label={`Decrease quantity of ${product.name}`}
              className="flex size-8 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RiSubtractLine className="size-3.5" aria-hidden="true" />
            </button>
            <span
              className="min-w-[2.75rem] text-center text-xs font-semibold tabular-nums text-foreground"
              aria-live="polite"
            >
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => handleQuantityChange(quantity + step)}
              disabled={quantity >= stock || isPending || isUnavailable}
              aria-label={`Increase quantity of ${product.name}`}
              className="flex size-8 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RiAddLine className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>

        {/* Line Total */}
        <div className="min-w-[5rem] text-right">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {CURRENCY}
            {lineTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Remove button */}
        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending}
          aria-label={`Remove ${product.name} from cart`}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RiDeleteBinLine className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
