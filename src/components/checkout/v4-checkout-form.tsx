"use client";

/**
 * UMA V4 — Checkout Form (Client Component)
 *
 * Handles fulfillment selection, delivery address, pickup date, notes,
 * and submission with error handling. Shared cart context is shown at page level.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  RiTruckLine,
  RiStore2Line,
  RiShoppingBagLine,
  RiCheckboxCircleFill,
  RiAlertLine,
  RiArrowLeftLine,
  RiInformationLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { placeV4Checkout } from "@/app/checkout/actions";
import type { V4CheckoutOrderGroup } from "@/app/checkout/actions";
import { checkoutError, genericCheckoutError } from "@/lib/checkout-errors";
import type { CheckoutError } from "@/lib/checkout-errors";
import type { CartItem } from "@/lib/types";
import type { FulfillmentType } from "@/lib/constants";
import { CURRENCY } from "@/lib/constants";
import { routes } from "@/platform/routes";

interface V4CheckoutFormProps {
  byProducer: Record<string, CartItem[]>;
  businessName: string;
}

export function V4CheckoutForm({ byProducer, businessName }: V4CheckoutFormProps) {
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<CheckoutError | null>(null);
  const [pickupDateError, setPickupDateError] = useState<CheckoutError | null>(null);
  const [deliveryAddressError, setDeliveryAddressError] = useState<CheckoutError | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const producerEntries = Object.entries(byProducer);
  const producerCount = producerEntries.length;

  const grandTotal = Object.values(byProducer)
    .flat()
    .reduce((sum, item) => sum + (item.product?.price_per_unit ?? 0) * item.quantity, 0);

  function applyServerError(next: CheckoutError | undefined) {
    const resolved = next ?? genericCheckoutError();
    setError(null);
    setPickupDateError(null);
    setDeliveryAddressError(null);

    if (resolved.field === "pickupDate") {
      setPickupDateError(resolved);
      return;
    }
    if (resolved.field === "deliveryAddress") {
      setDeliveryAddressError(resolved);
      return;
    }
    setError(resolved);
  }

  function clearFieldError(field: "pickupDate" | "deliveryAddress") {
    if (field === "pickupDate") setPickupDateError(null);
    else setDeliveryAddressError(null);
    setError(null);
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPickupDateError(null);
    setDeliveryAddressError(null);

    if (fulfillmentType === "seller_delivery" && !deliveryAddress.trim()) {
      setDeliveryAddressError(checkoutError("DELIVERY_ADDRESS_REQUIRED"));
      return;
    }

    if (fulfillmentType === "pickup" && !pickupDate.trim()) {
      setPickupDateError(checkoutError("PICKUP_DATE_REQUIRED"));
      return;
    }

    startTransition(async () => {
      const orders: V4CheckoutOrderGroup[] = producerEntries.map(([farmerClerkId, items]) => ({
        farmerClerkId,
        fulfillmentType,
        deliveryAddress: fulfillmentType === "seller_delivery" ? deliveryAddress : undefined,
        pickupDate: fulfillmentType === "pickup" ? pickupDate : undefined,
        notes: notes || undefined,
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
      }));

      let result: Awaited<ReturnType<typeof placeV4Checkout>>;
      try {
        result = await placeV4Checkout(orders);
      } catch {
        applyServerError(undefined);
        return;
      }

      if (!result.success || !result.orderIds || result.orderIds.length === 0) {
        applyServerError(result.error);
        return;
      }

      // Navigate to V4 confirmation
      if (result.orderIds.length === 1) {
        router.push(routes.checkoutConfirmation(result.orderIds[0]));
      } else {
        router.push(`${routes.checkoutConfirmation()}?order_ids=${result.orderIds.join(",")}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8" data-testid="v4-checkout-form">
      {/* ── Order Summary ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
        <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-foreground">Order Summary</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ordering as <span className="font-medium text-foreground">{businessName}</span>
          </p>
        </div>

        <div className="divide-y divide-border">
          {producerEntries.map(([producerId, items]) => {
            const farmer = items[0]?.product?.farmer;
            const farmerName = farmer?.business_name || farmer?.full_name || "Local Producer";
            const isVerified = Boolean(farmer?.is_verified);
            const subtotal = items.reduce(
              (sum, i) => sum + (i.product?.price_per_unit ?? 0) * i.quantity,
              0
            );

            return (
              <div key={producerId} className="px-4 py-4 sm:px-5">
                <div className="flex items-center gap-2 mb-3">
                  <RiStore2Line className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground truncate">{farmerName}</span>
                  {isVerified && (
                    <span title="Verified Producer" aria-label="Verified Producer">
                      <RiCheckboxCircleFill
                        className="size-3.5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    const product = item.product;
                    const lineTotal = (product?.price_per_unit ?? 0) * item.quantity;
                    return (
                      <div key={item.id} className="flex items-start gap-3">
                        {product?.image_url && (
                          <div className="relative size-10 shrink-0 rounded-lg overflow-hidden bg-muted">
                            <Image
                              src={product.image_url}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground truncate">
                              {product?.name} × {item.quantity} {product?.unit}
                            </span>
                            <span className="font-medium text-foreground tabular-nums shrink-0">
                              {CURRENCY}
                              {lineTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between border-t border-border/60 pt-2 mt-1">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {CURRENCY}{subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
          <p className="font-semibold text-foreground">Total</p>
          <p className="text-xl font-bold text-foreground tabular-nums">
            {CURRENCY}{grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* ── Multi-producer notice ─────────────────────────────────── */}
      {producerCount > 1 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
          <RiInformationLine className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Your cart spans <strong>{producerCount} producers</strong> — this will create{" "}
            <strong>{producerCount} separate orders</strong>, one per producer.
          </span>
        </div>
      )}

      {/* ── Fulfillment type ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <Label className="text-sm font-medium">Fulfillment</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setFulfillmentType("pickup");
              setPickupDateError(null);
              setDeliveryAddressError(null);
              setError(null);
            }}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
              fulfillmentType === "pickup"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/40"
            }`}
          >
            <RiStore2Line
              className={`mt-0.5 size-5 shrink-0 ${
                fulfillmentType === "pickup" ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-foreground">Pickup</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Collect from the producer&apos;s location
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFulfillmentType("seller_delivery");
              setPickupDateError(null);
              setDeliveryAddressError(null);
              setError(null);
            }}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
              fulfillmentType === "seller_delivery"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/40"
            }`}
          >
            <RiTruckLine
              className={`mt-0.5 size-5 shrink-0 ${
                fulfillmentType === "seller_delivery" ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-foreground">Seller Delivery</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Producer delivers to your address
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Delivery address (conditional) ────────────────────────── */}
      {fulfillmentType === "seller_delivery" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delivery-address">Delivery Address</Label>
          <Input
            id="delivery-address"
            value={deliveryAddress}
            onChange={(e) => {
              setDeliveryAddress(e.target.value);
              if (deliveryAddressError) clearFieldError("deliveryAddress");
            }}
            placeholder="Street, barangay, city"
            required
            aria-invalid={deliveryAddressError ? true : undefined}
            aria-describedby={deliveryAddressError ? "delivery-address-error" : undefined}
          />
          {deliveryAddressError && (
            <p id="delivery-address-error" role="alert" className="text-xs font-medium text-destructive">
              {deliveryAddressError.message}
            </p>
          )}
        </div>
      )}

      {/* ── Pickup date (conditional) ─────────────────────────────── */}
      {fulfillmentType === "pickup" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pickup-date">Pickup Date</Label>
          <Input
            id="pickup-date"
            type="date"
            min={today}
            value={pickupDate}
            onChange={(e) => {
              setPickupDate(e.target.value);
              if (pickupDateError) clearFieldError("pickupDate");
            }}
            required
            aria-invalid={pickupDateError ? true : undefined}
            aria-describedby={pickupDateError ? "pickup-date-error" : "pickup-date-hint"}
          />
          {pickupDateError ? (
            <p id="pickup-date-error" role="alert" className="text-xs font-medium text-destructive">
              {pickupDateError.message}
            </p>
          ) : (
            <p id="pickup-date-hint" className="text-xs text-muted-foreground">
              Choose when you will collect your order from the producer.
            </p>
          )}
        </div>
      )}

      {/* ── Notes ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-notes">
          Notes <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="order-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special instructions for the producer…"
          rows={3}
          className="resize-none"
        />
      </div>

      {/* ── Form error banner ─────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex flex-col gap-2"
        >
          <div className="flex items-start gap-2">
            <RiAlertLine className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="font-medium">{error.message}</p>
          </div>
          {error.code === "CART_CONFLICT" && (
            <div>
              <Link
                href={routes.cart}
                className="inline-flex items-center text-xs font-semibold underline hover:text-destructive/80"
              >
                Return to Cart →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Submit ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="w-full sm:w-auto"
          data-testid="v4-place-order-btn"
        >
          <RiShoppingBagLine className="size-4 mr-2" />
          {isPending ? "Placing order…" : "Place Order"}
        </Button>
        <Link
          href={routes.cart}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <RiArrowLeftLine className="size-3.5" />
          Back to Cart
        </Link>
      </div>
    </form>
  );
}
