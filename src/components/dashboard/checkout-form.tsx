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
import type { CartItem } from "@/lib/types";
import type { FulfillmentType } from "@/lib/constants";

interface CheckoutFormProps {
  byFarmer: Record<string, CartItem[]>;
}

export function CheckoutForm({ byFarmer }: CheckoutFormProps) {
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (fulfillmentType === "seller_delivery" && !deliveryAddress.trim()) {
      setError("Please enter a delivery address.");
      return;
    }

    startTransition(async () => {
      const farmerEntries = Object.entries(byFarmer);
      const orders = farmerEntries.map(([farmerClerkId, items]) => ({
        farmerClerkId,
        fulfillmentType,
        deliveryAddress: fulfillmentType === "seller_delivery" ? deliveryAddress : undefined,
        notes: notes || undefined,
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
      }));

      const result = await placeMultiFarmerCheckout(orders);

      if (!result.success || !result.orderIds || result.orderIds.length === 0) {
        setError(result.error ?? "Failed to place orders. Please try again.");
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Fulfillment type */}
      <div className="flex flex-col gap-3">
        <Label className="text-sm font-medium">Fulfillment</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFulfillmentType("pickup")}
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
            onClick={() => setFulfillmentType("seller_delivery")}
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
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Street, barangay, city"
            required
          />
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
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex flex-col gap-2">
          <p className="font-medium">{error}</p>
          {(error.includes("cart") || error.includes("another window")) && (
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
