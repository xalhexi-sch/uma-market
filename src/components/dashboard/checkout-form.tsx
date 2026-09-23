"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiTruckLine, RiStore2Line, RiShoppingBagLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { placeOrder } from "@/app/(dashboard)/business/checkout/actions";
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
      let lastOrderId: string | undefined;
      const errors: string[] = [];

      // Place one order per farmer group sequentially
      for (const [farmerClerkId, items] of farmerEntries) {
        const result = await placeOrder({
          farmerClerkId,
          fulfillmentType,
          deliveryAddress: fulfillmentType === "seller_delivery" ? deliveryAddress : undefined,
          notes: notes || undefined,
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
          })),
        });

        if (result.success && result.orderId) {
          lastOrderId = result.orderId;
        } else {
          errors.push(result.error ?? "Order failed for one farmer.");
        }
      }

      if (errors.length > 0) {
        setError(errors.join(" "));
        return;
      }

      // Redirect to confirmation of last order, or orders list if multiple
      if (farmerEntries.length === 1 && lastOrderId) {
        router.push(`/business/checkout/confirmation/${lastOrderId}`);
      } else {
        router.push("/business/orders");
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
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
        <RiShoppingBagLine className="size-4 mr-2" />
        {isPending ? "Placing order…" : "Place Order"}
      </Button>
    </form>
  );
}
