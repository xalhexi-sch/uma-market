import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiArrowLeftLine,
  RiPlantLine,
  RiTruckLine,
  RiStore2Line,
} from "@remixicon/react";
import { getBusinessOrderById } from "@/lib/supabase/queries/orders";
import { getOrderMessages } from "@/lib/supabase/queries/messages";
import { BusinessOrderStatusSection } from "@/components/dashboard/business-order-status-sync";
import { OrderChat } from "@/components/dashboard/order-chat";
import { OrderTimeline } from "@/components/dashboard/order-timeline";
import { OrderReviewPanel } from "@/components/reviews/order-review-panel";
import { CURRENCY, FULFILLMENT_LABELS } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import { getOrderReviewStatus } from "@/lib/supabase/queries/reviews";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order #${id.slice(0, 8).toUpperCase()}` };
}

function formatPickupDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-PH", { dateStyle: "long" });
}

export default async function BusinessOrderDetailPage({ params }: PageProps) {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole | undefined;
  if (role !== "business" || !userId) redirect("/onboarding");

  const { id } = await params;
  const order = await getBusinessOrderById(id, userId);
  if (!order) notFound();

  const messages = await getOrderMessages(order.id);
  const reviewStatus = order.status === "completed"
    ? await getOrderReviewStatus(order.id, userId)
    : { sellerReviewed: false, reviewedProductItemIds: [] };

  const farmerName =
    order.farmer?.business_name || order.farmer?.full_name || "Local Farm";
  const isDelivery = order.fulfillment_type === "seller_delivery";
  const placedDate = new Date(order.created_at).toLocaleDateString("en-PH", {
    dateStyle: "long",
  });
  const formattedPickupDate = order.pickup_date
    ? formatPickupDate(order.pickup_date)
    : null;

  // ── Server-rendered content sections ───
  const itemsContent = (
    <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium text-foreground">Items Ordered</p>
      </div>
      <div className="divide-y divide-border px-4">
        {(order.items ?? []).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-3 text-sm"
          >
            <div>
              <p className="font-medium text-foreground">
                {item.product_name ?? "Product"}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.quantity} {item.unit} × {CURRENCY}
                {item.unit_price.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}{" "}
                / {item.unit}
              </p>
            </div>
            <p className="font-semibold text-foreground tabular-nums">
              {CURRENCY}
              {item.subtotal.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
        <p className="font-medium text-foreground">Total</p>
        <p className="text-lg font-bold text-foreground tabular-nums">
          {CURRENCY}
          {(order.total_amount ?? 0).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
          })}
        </p>
      </div>
    </div>
  );

  const fulfillmentContent = (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
      {isDelivery ? (
        <RiTruckLine className="size-5 text-primary shrink-0 mt-0.5" />
      ) : (
        <RiStore2Line className="size-5 text-primary shrink-0 mt-0.5" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          {FULFILLMENT_LABELS[order.fulfillment_type]}
        </p>
        {isDelivery && order.delivery_address && (
          <p className="text-sm text-muted-foreground mt-0.5">
            Deliver to: {order.delivery_address}
          </p>
        )}
        {!isDelivery && formattedPickupDate && (
          <p className="text-sm text-muted-foreground mt-0.5">
            Scheduled pickup: <span className="text-foreground font-medium">{formattedPickupDate}</span>
          </p>
        )}
        {order.notes && (
          <p className="text-sm text-muted-foreground mt-1.5 italic bg-muted/40 p-2.5 rounded-lg border border-border/50">
            &ldquo;{order.notes}&rdquo;
          </p>
        )}
      </div>
    </div>
  );

  const contactContent = (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <RiPlantLine className="size-5 text-primary" />
      </div>
      <div>
        <p className="font-medium text-foreground">{farmerName}</p>
        {order.farmer?.city && (
          <p className="text-sm text-muted-foreground">{order.farmer.city}</p>
        )}
        {order.farmer?.phone && (
          <a
            href={`tel:${order.farmer.phone}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {order.farmer.phone}
          </a>
        )}
      </div>
    </div>
  );

  const chatContent = (
    <OrderChat
      orderId={order.id}
      currentUserId={userId}
      initialMessages={messages}
      counterpartyName={farmerName}
    />
  );

  return (
    <div className="flex flex-col gap-0 min-h-full">
      <div className="border-b border-border px-4 sm:px-6 py-3 lg:px-8">
        <Link
          href="/business/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[36px]"
        >
          <RiArrowLeftLine className="size-3.5" />
          Back to Orders
        </Link>
      </div>

      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
        {/* Order Progress Timeline */}
        <OrderTimeline
          status={order.status}
          fulfillmentType={order.fulfillment_type}
          cancellationReason={order.cancellation_reason}
        />

        {/* Live-synced header + responsive workspace layout */}
        <BusinessOrderStatusSection
          orderId={order.id}
          farmerName={farmerName}
          orderCreatedAt={order.created_at}
          placedDate={placedDate}
          initialStatus={order.status}
          initialCancellationReason={order.cancellation_reason}
          fulfillmentType={order.fulfillment_type}
          itemsCount={order.items?.length ?? 0}
          itemsContent={itemsContent}
          fulfillmentContent={fulfillmentContent}
          contactContent={contactContent}
          chatContent={chatContent}
        />
        {order.status === "completed" && (
          <OrderReviewPanel
            orderId={order.id}
            farmerName={farmerName}
            items={order.items ?? []}
            sellerReviewed={reviewStatus.sellerReviewed}
            reviewedProductItemIds={reviewStatus.reviewedProductItemIds}
          />
        )}
      </div>
    </div>
  );
}
