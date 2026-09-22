import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { RiArrowLeftLine, RiShoppingBagLine } from "@remixicon/react";
import { getCartItems } from "@/lib/supabase/queries/cart";
import { CheckoutForm } from "@/components/dashboard/checkout-form";
import { CURRENCY } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "business" || !userId) redirect("/onboarding");

  const cartItems = await getCartItems(userId);

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
        <RiShoppingBagLine className="size-10 text-muted-foreground/40" />
        <p className="font-medium text-foreground">Your cart is empty</p>
        <Link href="/business/products" className={buttonVariants({ variant: "outline" })}>Browse Products</Link>
      </div>
    );
  }

  // Group by farmer — one order per farmer
  const byFarmer = cartItems.reduce<Record<string, typeof cartItems>>((acc, item) => {
    const fid = item.product?.farmer_clerk_id ?? "unknown";
    if (!acc[fid]) acc[fid] = [];
    acc[fid].push(item);
    return acc;
  }, {});

  const grandTotal = cartItems.reduce(
    (sum, item) => sum + (item.product?.price_per_unit ?? 0) * item.quantity,
    0
  );

  return (
    <div className="flex flex-col gap-0 min-h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-3 lg:px-8">
        <Link
          href="/business/cart"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RiArrowLeftLine className="size-3.5" />
          Back to Cart
        </Link>
      </div>

      <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Checkout</h1>
          {Object.keys(byFarmer).length > 1 && (
            <p className="mt-1 text-sm text-muted-foreground">
              Your cart spans {Object.keys(byFarmer).length} farmers —
              this will create {Object.keys(byFarmer).length} separate orders.
            </p>
          )}
        </div>

        {/* Order summary */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium text-foreground">Order Summary</p>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(byFarmer).map(([farmerId, items]) => {
              const farmer = items[0]?.product?.farmer;
              const farmerName =
                farmer?.business_name || farmer?.full_name || "Local Farm";
              const subtotal = items.reduce(
                (sum, i) => sum + (i.product?.price_per_unit ?? 0) * i.quantity,
                0
              );
              return (
                <div key={farmerId} className="p-4">
                  <p className="text-sm font-medium text-foreground mb-3">{farmerName}</p>
                  <div className="flex flex-col gap-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.product?.name} × {item.quantity} {item.product?.unit}
                        </span>
                        <span className="font-medium text-foreground tabular-nums">
                          {CURRENCY}
                          {((item.product?.price_per_unit ?? 0) * item.quantity).toLocaleString(
                            "en-PH", { minimumFractionDigits: 2 }
                          )}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
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
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
            <p className="font-medium text-foreground">Total</p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {CURRENCY}{grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Checkout form */}
        <CheckoutForm byFarmer={byFarmer} />
      </div>
    </div>
  );
}
