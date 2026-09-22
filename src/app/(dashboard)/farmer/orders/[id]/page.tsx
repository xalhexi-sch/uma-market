import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { RiArrowLeftLine, RiBuildingLine, RiTruckLine, RiStore2Line } from "@remixicon/react";
import { getFarmerOrderById } from "@/lib/supabase/queries/orders";
import { getOrderMessages } from "@/lib/supabase/queries/messages";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderStatusActions } from "@/components/dashboard/order-status-actions";
import { OrderChat } from "@/components/dashboard/order-chat";
import { CURRENCY, FULFILLMENT_LABELS } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order #${id.slice(0, 8).toUpperCase()}` };
}

export default async function FarmerOrderDetailPage({ params }: PageProps) {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "farmer" || !userId) {
    redirect(role === "business" ? "/business" : "/onboarding");
  }

  const { id } = await params;
  const order = await getFarmerOrderById(id, userId);
  if (!order) notFound();

  const messages = await getOrderMessages(order.id);

  const bizName = order.business?.business_name || order.business?.full_name || "Business";
  const isDelivery = order.fulfillment_type === "seller_delivery";


  return (
    <div className="flex flex-col gap-0 min-h-full">
      <div className="border-b border-border px-6 py-3 lg:px-8">
        <Link
          href="/farmer/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RiArrowLeftLine className="size-3.5" />
          Back to Orders
        </Link>
      </div>

      <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-mono">
              #{order.id.slice(0, 8).toUpperCase()}
            </p>
            <h1 className="mt-0.5 text-xl font-semibold text-foreground">Order from {bizName}</h1>
            <p className="text-sm text-muted-foreground">
              Placed{" "}
              {new Date(order.created_at).toLocaleDateString("en-PH", {
                dateStyle: "long",
              })}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        {/* Status Actions */}
        <OrderStatusActions orderId={order.id} currentStatus={order.status} />

        {/* Business contact */}
        <div className="flex items-center gap-3 rounded-xl border border-border p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <RiBuildingLine className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">{bizName}</p>
            {order.business?.city && (
              <p className="text-sm text-muted-foreground">{order.business.city}</p>
            )}
            {order.business?.phone && (
              <p className="text-sm text-muted-foreground">{order.business.phone}</p>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium text-foreground">Items</p>
          </div>
          <div className="divide-y divide-border px-4">
            {(order.items ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{item.product_name ?? "Product"}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} {item.unit} × {CURRENCY}
                    {item.unit_price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <p className="font-semibold text-foreground tabular-nums">
                  {CURRENCY}{item.subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
            <p className="font-medium text-foreground">Total</p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {CURRENCY}
              {(order.total_amount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Fulfillment */}
        <div className="flex items-center gap-3 rounded-xl border border-border p-4">
          {isDelivery ? (
            <RiTruckLine className="size-5 text-primary shrink-0" />
          ) : (
            <RiStore2Line className="size-5 text-primary shrink-0" />
          )}
          <div>
            <p className="font-medium text-foreground">
              {FULFILLMENT_LABELS[order.fulfillment_type]}
            </p>
            {isDelivery && order.delivery_address && (
              <p className="text-sm text-muted-foreground">
                Deliver to: {order.delivery_address}
              </p>
            )}
            {order.business?.address && !isDelivery && (
              <p className="text-sm text-muted-foreground">
                Business at: {order.business.address}
              </p>
            )}
            {order.notes && (
              <p className="text-sm text-muted-foreground mt-1 italic">
                &ldquo;{order.notes}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Order Communications */}
        <OrderChat
          orderId={order.id}
          currentUserId={userId}
          initialMessages={messages}
          counterpartyName={bizName}
        />
      </div>
    </div>
  );
}

