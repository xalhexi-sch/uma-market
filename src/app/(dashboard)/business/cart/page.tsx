import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { RiShoppingCart2Line, RiShoppingBagLine } from "@remixicon/react";
import { getCartItems } from "@/lib/supabase/queries/cart";
import { CartItemRow } from "@/components/dashboard/cart-item-row";
import { CURRENCY } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "My Cart" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "business" || !userId) {
    redirect("/onboarding");
  }

  const cartItems = await getCartItems(userId);

  // Group by farmer for clear checkout context
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

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <RiShoppingCart2Line className="size-8 text-muted-foreground/60" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Your cart is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse local products and add them to your cart.
          </p>
        </div>
        <Link href="/business/products" className={buttonVariants()}>Explore Products</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cartItems.length} item{cartItems.length !== 1 ? "s" : ""} from{" "}
          {Object.keys(byFarmer).length} farmer{Object.keys(byFarmer).length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {Object.entries(byFarmer).map(([farmerId, items]) => {
          const farmer = items[0]?.product?.farmer;
          const farmerName =
            farmer?.business_name || farmer?.full_name || "Local Farm";
          const farmerTotal = items.reduce(
            (sum, item) => sum + (item.product?.price_per_unit ?? 0) * item.quantity,
            0
          );

          return (
            <div key={farmerId} className="rounded-xl border border-border overflow-hidden">
              {/* Farmer header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{farmerName}</span>
                  {farmer?.city && (
                    <span className="text-xs text-muted-foreground">· {farmer.city}</span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  Subtotal:{" "}
                  <span className="font-semibold text-foreground">
                    {CURRENCY}{farmerTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </span>
                </span>
              </div>

              {/* Items */}
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <CartItemRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary + checkout */}
      <div className="sticky bottom-0 -mx-6 -mb-6 lg:-mx-8 lg:-mb-8 border-t border-border bg-background/95 backdrop-blur-sm px-6 py-4 lg:px-8">
        <div className="flex items-center justify-between max-w-4xl">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">
              {CURRENCY}{grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {Object.keys(byFarmer).length > 1
                ? `Creates ${Object.keys(byFarmer).length} separate orders (one per farmer)`
                : ""}
            </p>
          </div>
          <Link href="/business/checkout" className={buttonVariants({ size: "lg" })}>
            <RiShoppingBagLine className="size-4 mr-2" />
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
