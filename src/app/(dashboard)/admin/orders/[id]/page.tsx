import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiArrowLeftLine,
  RiStore2Line,
  RiPlantLine,
  RiTruckLine,
  RiMapPinLine,
  RiChat3Line,
} from "@remixicon/react";
import { getAdminOrderById } from "@/lib/supabase/queries/admin";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CURRENCY } from "@/lib/constants";
import type { UserRole, OrderStatus } from "@/lib/constants";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Audit Order #${id.slice(0, 8).toUpperCase()} — UMA Admin` };
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;

  if (role !== "admin") {
    redirect(role === "farmer" ? "/farmer" : role === "business" ? "/business" : "/onboarding");
  }

  const { id } = await params;
  const { order, messages } = await getAdminOrderById(id);

  if (!order) {
    notFound();
  }

  const buyerName = order.business?.business_name || order.business?.full_name || "Commercial Buyer";
  const farmerName = order.farmer?.business_name || order.farmer?.full_name || "Farm Supplier";
  const isDelivery = order.fulfillment_type === "seller_delivery";
  const ref = `UMA-${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="flex flex-col gap-0 min-h-full">
      {/* Top back banner */}
      <div className="border-b border-border px-6 py-3 lg:px-8">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RiArrowLeftLine className="size-3.5" />
          Back to Orders Audit
        </Link>
      </div>

      <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                {ref}
              </span>
              <Badge variant="outline" className="capitalize text-xs font-medium">
                {isDelivery ? "Seller Delivery" : "Farm Pickup"}
              </Badge>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              Order Audit Inspection
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Placed {new Date(order.created_at).toLocaleDateString("en-PH", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <OrderStatusBadge status={order.status as OrderStatus} />
          </div>
        </div>

        {/* Cancellation Notice if cancelled */}
        {order.status === "cancelled" && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-medium">Order Cancelled</p>
            {order.cancellation_reason && (
              <p className="mt-1 text-xs text-muted-foreground">
                Reason: <span className="text-foreground">{order.cancellation_reason}</span>
              </p>
            )}
            {order.cancelled_at && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Cancelled on {new Date(order.cancelled_at).toLocaleString("en-PH")}
              </p>
            )}
          </div>
        )}

        {/* Counterparty details cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Buyer Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <RiStore2Line className="size-4 text-primary" />
                Commercial Buyer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium text-foreground">{buyerName}</p>
              {order.business?.full_name && order.business.business_name && (
                <p className="text-xs text-muted-foreground">Contact: {order.business.full_name}</p>
              )}
              {order.business?.phone && (
                <p className="text-xs text-muted-foreground">Phone: {order.business.phone}</p>
              )}
              {order.business?.city && (
                <p className="text-xs text-muted-foreground">Location: {order.business.city}</p>
              )}
            </CardContent>
          </Card>

          {/* Farmer Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <RiPlantLine className="size-4 text-emerald-600" />
                Farm Producer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium text-foreground">{farmerName}</p>
              {order.farmer?.full_name && order.farmer.business_name && (
                <p className="text-xs text-muted-foreground">Producer: {order.farmer.full_name}</p>
              )}
              {order.farmer?.phone && (
                <p className="text-xs text-muted-foreground">Phone: {order.farmer.phone}</p>
              )}
              {order.farmer?.city && (
                <p className="text-xs text-muted-foreground">Location: {order.farmer.city}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fulfillment Specs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <RiTruckLine className="size-4 text-primary" />
              Fulfillment Logistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <RiMapPinLine className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">
                  {isDelivery ? "Delivery Destination:" : "Pickup Location:"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {order.delivery_address || (isDelivery ? "Address not specified" : `${farmerName} Farm Gate`)}
                </span>
              </div>
            </div>
            {order.notes && (
              <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
                <span className="font-medium text-foreground">Notes: </span>
                {order.notes}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Purchased Line Items
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <th className="py-2.5 px-4">Item</th>
                    <th className="py-2.5 px-4 text-right">Unit Price</th>
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    <th className="py-2.5 px-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item) => (
                      <tr key={item.id} className="border-b border-border text-xs sm:text-sm">
                        <td className="py-3 px-4 font-medium text-foreground">
                          {item.product_name}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground tabular-nums">
                          {CURRENCY}{Number(item.unit_price).toFixed(2)} / {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right text-foreground tabular-nums">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-foreground tabular-nums">
                          {CURRENCY}{Number(item.subtotal).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                        No line items recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold text-sm">
                    <td colSpan={3} className="py-3 px-4 text-right text-foreground">
                      Total Order Amount:
                    </td>
                    <td className="py-3 px-4 text-right text-foreground tabular-nums">
                      {CURRENCY}{(Number(order.total_amount) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Read-Only Communication Log */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <RiChat3Line className="size-4 text-primary" />
                Counterparty Direct Messages ({messages.length})
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Read-Only Audit Log
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No direct messages were exchanged between buyer and farmer for this order.
              </p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {messages.map((m) => {
                  const isBuyer = m.sender_clerk_id === order.business_clerk_id;
                  const senderName = m.sender?.full_name || (isBuyer ? "Buyer" : "Farmer");
                  const timeStr = new Date(m.created_at).toLocaleString("en-PH", {
                    dateStyle: "short",
                    timeStyle: "short",
                  });

                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-lg text-xs space-y-1 ${
                        isBuyer
                          ? "bg-primary/5 border border-primary/10 ml-0 mr-8"
                          : "bg-muted/60 border border-border ml-8 mr-0"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-foreground">
                          {senderName} ({isBuyer ? "Buyer" : "Farmer"})
                        </span>
                        <span className="text-muted-foreground">{timeStr}</span>
                      </div>
                      <p className="text-foreground leading-relaxed text-xs">{m.body}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
