import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiCheckboxCircleLine,
  RiShoppingBagLine,
  RiTruckLine,
  RiStore2Line,
  RiPlantLine,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { getBusinessOrderById } from "@/lib/supabase/queries/orders";
import { buttonVariants } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Separator } from "@/components/ui/separator";
import { CURRENCY, FULFILLMENT_LABELS } from "@/lib/constants";
import { requireActiveBusiness } from "@/platform";
import { routes } from "@/platform/routes";
import { AppError } from "@/platform/errors";

export const metadata: Metadata = { title: "Order Confirmed — UMA Market" };

interface PageProps {
  params: Promise<{ orderId: string }>;
}

function formatPickupDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-PH", { dateStyle: "long" });
}

export default async function V4OrderConfirmationPage({ params }: PageProps) {
  let context;
  try {
    context = await requireActiveBusiness();
  } catch (error: unknown) {
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
      redirect(routes.signIn);
    }
    redirect(routes.onboarding);
  }

  const { orderId } = await params;
  // Use the legacy_clerk_id for order lookup (the RPC writes it to business_clerk_id)
  const userId = context.business.legacy_clerk_id ?? context.user.userId;
  const order = await getBusinessOrderById(orderId, userId);
  if (!order) notFound();

  const farmerName =
    order.farmer?.business_name || order.farmer?.full_name || "Local Producer";
  const isDelivery = order.fulfillment_type === "seller_delivery";
  const formattedPickupDate = order.pickup_date
    ? formatPickupDate(order.pickup_date)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader />
      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-8 sm:px-6 sm:py-12">
        {/* Success header */}
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <RiCheckboxCircleLine className="size-9 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Order Placed</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your order has been sent to {farmerName}.
            </p>
          </div>
        </div>

        {/* Order card */}
        <div className="rounded-xl border border-border overflow-hidden shadow-2xs">
          {/* Order meta */}
          <div className="border-b border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Order reference</p>
              <p className="font-mono text-sm font-medium text-foreground">
                #{order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          {/* Producer */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <RiPlantLine className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{farmerName}</p>
              {order.farmer?.city && (
                <p className="text-xs text-muted-foreground">{order.farmer.city}</p>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="divide-y divide-border px-4">
            {(order.items ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="text-foreground">{item.product_name ?? "Product"}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.quantity} {item.unit} × {CURRENCY}
                    {item.unit_price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <p className="font-medium text-foreground tabular-nums">
                  {CURRENCY}
                  {item.subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3">
            <p className="font-medium text-foreground">Total</p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {CURRENCY}
              {(order.total_amount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Fulfillment */}
          <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-3 text-sm">
            {isDelivery ? (
              <RiTruckLine className="size-4 text-primary shrink-0" />
            ) : (
              <RiStore2Line className="size-4 text-primary shrink-0" />
            )}
            <span className="text-muted-foreground">
              {FULFILLMENT_LABELS[order.fulfillment_type]}
              {isDelivery && order.delivery_address ? ` · ${order.delivery_address}` : ""}
              {!isDelivery && formattedPickupDate ? ` · Scheduled pickup: ${formattedPickupDate}` : ""}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-6 sm:flex-row">
          <Link
            href={routes.dashboard.business.orders}
            className={buttonVariants({ size: "lg", className: "flex-1 justify-center" })}
          >
            <RiShoppingBagLine className="size-4 mr-2" />
            View Orders
          </Link>
          <Link
            href={routes.products}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "flex-1 justify-center",
            })}
          >
            Continue Shopping
          </Link>
        </div>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
