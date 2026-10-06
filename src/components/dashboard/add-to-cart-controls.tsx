"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiShoppingCart2Line, RiSubtractLine, RiAddLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { addToBusinessCart } from "@/platform/cart-actions";
import type { Product } from "@/lib/types";
import { CURRENCY } from "@/lib/constants";
import { routes } from "@/platform/routes";

interface AddToCartControlsProps {
  product: Product;
}

export function AddToCartControls({ product }: AddToCartControlsProps) {
  const [quantity, setQuantity] = useState(product.min_order_quantity);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const step = product.unit === "kg" || product.unit === "g" ? 0.5 : 1;
  const min = product.min_order_quantity;
  const max = product.quantity_available;

  function decrement() {
    setQuantity((q) => Math.max(min, +(q - step).toFixed(2)));
  }
  function increment() {
    setQuantity((q) => Math.min(max, +(q + step).toFixed(2)));
  }

  function handleAddToCart() {
    setMessage(null);
    startTransition(async () => {
      const result = await addToBusinessCart(product.id, quantity);
      if (result.success) {
        toast.success(`"${result.productName}" added to cart.`);
        setMessage({ type: "success", text: `"${result.productName}" added to cart.` });
        router.refresh(); // refresh layout for cart count badge
      } else {
        toast.error(result.error ?? "Something went wrong.");
        setMessage({ type: "error", text: result.error ?? "Something went wrong." });
      }
    });
  }

  const isOutOfStock =
    product.quantity_available <= 0 || product.quantity_available < product.min_order_quantity;

  return (
    <div className="flex flex-col gap-4">
      {/* Quantity selector */}
      {!isOutOfStock && (
        <div className="flex flex-col gap-1.5" role="group" aria-label={`Quantity in ${product.unit}`}>
          <span className="text-sm font-medium text-foreground">Quantity ({product.unit})</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border">
              <button
                type="button"
                onClick={decrement}
                disabled={quantity <= min}
                className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                aria-label="Decrease quantity"
              >
                <RiSubtractLine className="size-4" />
              </button>
              <span className="min-w-[3rem] text-center text-sm font-semibold text-foreground tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={increment}
                disabled={quantity >= max}
                className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                aria-label="Increase quantity"
              >
                <RiAddLine className="size-4" />
              </button>
            </div>
            <span className="text-sm text-muted-foreground">
              = {CURRENCY}
              {(quantity * product.price_per_unit).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          {min > 1 && (
            <p className="text-xs text-muted-foreground">
              Minimum order: {min} {product.unit}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Button
          onClick={handleAddToCart}
          disabled={isPending || isOutOfStock}
          className="w-full sm:w-auto"
          size="lg"
        >
          <RiShoppingCart2Line className="size-4 mr-2" />
          {isPending ? "Adding…" : isOutOfStock ? "Out of Stock" : "Add to Cart"}
        </Button>

        {message?.type === "success" && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => router.push(routes.cart)}
          >
            View Cart →
          </Button>
        )}
      </div>

      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`text-sm ${
            message.type === "success" ? "text-primary" : "text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
