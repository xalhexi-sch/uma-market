"use client";

import { useState, useTransition } from "react";
import { RiDeleteBinLine, RiSubtractLine, RiAddLine } from "@remixicon/react";
import { updateCartItemQuantity, removeFromCart } from "@/app/(dashboard)/business/cart/actions";
import { getProductImageUrl } from "@/lib/supabase/storage";
import { ProductImage } from "@/components/ui/product-image";
import { CURRENCY } from "@/lib/constants";
import type { CartItem } from "@/lib/types";

interface CartItemRowProps {
  item: CartItem;
}

export function CartItemRow({ item }: CartItemRowProps) {
  const product = item.product;
  const [quantity, setQuantity] = useState(item.quantity);
  const [isPending, startTransition] = useTransition();

  if (!product) return null;

  const unit = product.unit;
  const step = unit === "kg" || unit === "g" ? 0.5 : 1;
  const min = product.min_order_quantity;
  const max = product.quantity_available;
  const lineTotal = quantity * product.price_per_unit;

  function handleQuantityChange(newQty: number) {
    const clamped = Math.max(min, Math.min(max, +newQty.toFixed(2)));
    setQuantity(clamped);
    startTransition(async () => {
      await updateCartItemQuantity(item.id, clamped);
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removeFromCart(item.id);
    });
  }

  const imageUrl = getProductImageUrl(product.image_path, product.image_url);

  return (
    <div className={`flex items-start gap-4 p-4 transition-opacity ${isPending ? "opacity-50" : ""}`}>
      {/* Image */}
      <div className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-muted">
        <ProductImage
          src={imageUrl}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <p className="font-medium text-foreground truncate">{product.name}</p>
        <p className="text-sm text-muted-foreground">
          {CURRENCY}
          {product.price_per_unit.toLocaleString("en-PH", { minimumFractionDigits: 2 })} /{" "}
          {unit}
        </p>

        {/* Quantity control */}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center rounded-md border border-border">
            <button
              onClick={() => handleQuantityChange(quantity - step)}
              disabled={quantity <= min || isPending}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RiSubtractLine className="size-3.5" />
            </button>
            <span className="min-w-[2.5rem] text-center text-sm font-medium tabular-nums">
              {quantity}
            </span>
            <button
              onClick={() => handleQuantityChange(quantity + step)}
              disabled={quantity >= max || isPending}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RiAddLine className="size-3.5" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>

      {/* Line total + remove */}
      <div className="flex flex-col items-end gap-3">
        <p className="font-semibold text-foreground tabular-nums">
          {CURRENCY}
          {lineTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </p>
        <button
          onClick={handleRemove}
          disabled={isPending}
          className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
          aria-label="Remove item"
        >
          <RiDeleteBinLine className="size-4" />
        </button>
      </div>
    </div>
  );
}
