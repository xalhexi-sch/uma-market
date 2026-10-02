"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RiTruckLine, RiStore2Line, RiShoppingBagLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { placeMultiFarmerCheckout } from "@/app/(dashboard)/business/checkout/actions";
import { checkoutError, genericCheckoutError } from "@/lib/checkout-errors";
import type { CheckoutError } from "@/lib/checkout-errors";
import type { CartItem } from "@/lib/types";
import type { FulfillmentType } from "@/lib/constants";

interface CheckoutFormProps {
  byFarmer: Record<string, CartItem[]>;
}

export function CheckoutForm({ byFarmer }: CheckoutFormProps) {
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [notes, setNotes] = useState("");
  /** Form-level failures (transaction, network, unexpected). */
  const [error, setError] = useState<CheckoutError | null>(null);
  /** Field-level failures, rendered inline next to the offending input. */
  const [pickupDateError, setPickupDateError] = useState<CheckoutError | null>(null);
  const [deliveryAddressError, setDeliveryAddressError] = useState<CheckoutError | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  /** Clears every message, then routes a server error to its field or the banner. */
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

    // Client-side pre-check mirrors the server rules so the customer gets an
    // immediate, field-anchored message. The server re-validates regardless.
    if (fulfillmentType === "seller_delivery" && !deliveryAddress.trim()) {
      setDeliveryAddressError(checkoutError("DELIVERY_ADDRESS_REQUIRED"));
      return;
    }

    if (fulfillmentType === "pickup" && !pickupDate.trim()) {
      setPickupDateError(checkoutError("PICKUP_DATE_REQUIRED"));
      return;
    }

    startTransition(async () => {
      const farmerEntries = Object.entries(byFarmer);
      const orders = farmerEntries.map(([farmerClerkId, items]) => ({
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

      let result: Awaited<ReturnType<typeof placeMultiFarmerCheckout>>;
      try {
        result = await placeMultiFarmerCheckout(orders);
      } catch {
        // Transport / unexpected server failure — never surface raw detail.
        applyServerError(undefined);
        return;
      }

      if (!result.success || !result.orderIds || result.orderIds.length === 0) {
        applyServerError(result.error);
        return;
      }

      // Single farmer order -> dedicated confirmation screen
      if (result.orderIds.length === 1) {
        router.push(`/business/checkout/confirmation/${result.orderIds[0]}`);
      } else {
        // Multi-farmer orders -> dedicated multi-order confirmation screen
        router.push(`/business/checkout/confirmation?order_ids=${result.orderIds.join(",")}`);
      }
    });
  }

  return (
    // noValidate: native constraint validation would block submit before
    // handleSubmit runs, showing the browser's generic bubble instead of our
    // styled, accessible field messages. The same rules are enforced here and
    // again on the server, so no rule is weakened.
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {/* Fulfillment type */}
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
                Collect from the farmer&apos;s location
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
                Farmer delivers to your address
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Delivery address (conditional) */}
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

      {/* Pickup date (conditional) */}
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
              Choose when you will collect your order from the farm.
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-notes">
          Notes <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="order-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special instructions for the farmer…"
          rows={3}
          className="resize-none"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex flex-col gap-2"
        >
          <p className="font-medium">{error.message}</p>
          {error.code === "CART_CONFLICT" && (
            <div>
              <Link
                href="/business/cart"
                className="inline-flex items-center text-xs font-semibold underline hover:text-destructive/80"
              >
                Return to Cart →
              </Link>
            </div>
          )}
        </div>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
        <RiShoppingBagLine className="size-4 mr-2" />
        {isPending ? "Placing order…" : "Place Order"}
      </Button>
    </form>
  );
}
