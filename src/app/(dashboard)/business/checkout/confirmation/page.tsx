import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiCheckboxCircleLine,
  RiShoppingBagLine,
  RiPlantLine,
  RiTruckLine,
  RiStore2Line,
  RiArrowRightLine,
  RiInformationLine,
} from "@remixicon/react";
import { getBusinessOrdersByIds } from "@/lib/supabase/queries/orders";
import { buttonVariants } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Separator } from "@/components/ui/separator";
import { CURRENCY, FULFILLMENT_LABELS } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

export const metadata: Metadata = { title: "Orders Confirmed" };

interface PageProps {
  searchParams: Promise<{ order_ids?: string }>;
}

export default async function MultiOrderConfirmationPage({ searchParams }: PageProps) {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "business" || !userId) redirect("/onboarding");

  const { order_ids } = await searchParams;
  if (!order_ids) redirect("/business/orders");

  const idList = order_ids
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (idList.length === 0) redirect("/business/orders");
  if (idList.length === 1) {
    redirect(`/business/checkout/confirmation/${idList[0]}`);
  }

  const orders = await getBusinessOrdersByIds(idList, userId);
  if (orders.length === 0) redirect("/business/orders");

  const grandTotal = orders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <RiCheckboxCircleLine className="size-9 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Orders Placed Successfully</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Created {orders.length} separate orders for {orders.length} local farms.
            </p>
          </div>
        </div>

        {/* Multi-farmer explanation card */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-primary flex items-start gap-3">
          <RiInformationLine className="size-4 shrink-0 mt-0.5 text-primary" />
          <p className="leading-relaxed text-foreground/80">
            Because UMA connects you directly to local agricultural producers, your items were split into separate orders so each farmer can individually prepare, pack, and fulfill their harvest.
          </p>
        </div>

        {/* Overall summary bar */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total Order Spend ({orders.length} orders)
            </span>
            <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">
              {CURRENCY}{grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">Initial Status</span>
            <OrderStatusBadge status="pending" />
          </div>
        </div>

        {/* Orders list */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">Created Orders</h2>
          {orders.map((order, idx) => {
            const farmerName =
              order.farmer?.business_name || order.farmer?.full_name || `Farm #${idx + 1}`;
            const isDelivery = order.fulfillment_type === "seller_delivery";

            return (
              <div
                key={order.id}
                className="rounded-xl border border-border bg-card overflow-hidden shadow-sm"
              >
                {/* Farmer & Order Reference Header */}
                <div className="border-b border-border bg-muted/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <RiPlantLine className="size-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{farmerName}</p>
                      {order.farmer?.city && (
                        <p className="text-xs text-muted-foreground">{order.farmer.city}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono text-xs font-medium text-foreground">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y divide-border px-4">
                  {(order.items ?? []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div className="min-w-0 pr-3">
                        <p className="text-foreground truncate font-medium">{item.product_name ?? "Product"}</p>
                        <p className="text-muted-foreground text-xs">
                          {item.quantity} {item.unit} × {CURRENCY}
                          {item.unit_price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <p className="font-medium text-foreground tabular-nums shrink-0">
                        {CURRENCY}
                        {item.subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Fulfillment and individual order total footer */}
                <div className="border-t border-border bg-muted/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {isDelivery ? (
                      <RiTruckLine className="size-3.5 text-primary shrink-0" />
                    ) : (
                      <RiStore2Line className="size-3.5 text-primary shrink-0" />
                    )}
                    <span>{FULFILLMENT_LABELS[order.fulfillment_type]}</span>
                    {isDelivery && order.delivery_address && (
                      <span className="truncate max-w-[200px] sm:max-w-xs">
                        · {order.delivery_address}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 ml-auto">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground mr-1.5">Subtotal:</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {CURRENCY}
                        {(order.total_amount ?? 0).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    <Link
                      href={`/business/orders/${order.id}`}
                      className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>Details</span>
                      <RiArrowRightLine className="size-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-3 mt-2 sm:flex-row">
          <Link
            href="/business/orders"
            className={buttonVariants({ size: "lg", className: "flex-1 justify-center" })}
          >
            <RiShoppingBagLine className="size-4 mr-2" />
            View Orders
          </Link>
          <Link
            href="/business/products"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "flex-1 justify-center",
            })}
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
