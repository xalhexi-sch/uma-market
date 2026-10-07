import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  RiArrowLeftLine,
  RiPlantLine,
  RiTruckLine,
  RiStore2Line,
  RiTimeLine,
  RiUserLine,
  RiBuildingLine,
  RiShieldCheckLine,
} from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import {
  getV4BuyerOrderById,
  getOrderPlacerProfile,
} from "@/lib/supabase/queries/orders";
import { getOrderReviewStatus } from "@/lib/supabase/queries/reviews";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderProgress } from "@/components/dashboard/order-progress";
import { OrderMessageAction } from "@/components/orders/order-message-action";
import { OrderReviewPanel } from "@/components/reviews/order-review-panel";
import { V4OrderStatusBanner } from "@/components/orders/v4-order-status-banner";
import { V4CancelOrderButton } from "@/components/orders/v4-cancel-order-button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CURRENCY, FULFILLMENT_LABELS } from "@/lib/constants";
import { requireActiveBusiness } from "@/platform";
import type { ActiveBusinessContext } from "@/platform";
import { routes } from "@/platform/routes";
import { AppError } from "@/platform/errors";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Order #${id.slice(0, 8).toUpperCase()} — UMA Market`,
    description: "Detailed view of wholesale produce order and fulfillment status.",
  };
}

function formatPickupDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-PH", { dateStyle: "long" });
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  let context: ActiveBusinessContext;
  const { id } = await params;

  try {
    context = await requireActiveBusiness();
  } catch (error: unknown) {
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
      redirect(`/sign-in?redirect_url=${encodeURIComponent(routes.order(id))}`);
    }
    redirect(routes.orders);
  }

  const order = await getV4BuyerOrderById(
    id,
    context.business.id,
    context.business.legacy_clerk_id
  );

  if (!order) {
    notFound();
  }

  // Fetch optional placer audit info and review status concurrently
  const [placerProfile, reviewStatus] = await Promise.all([
    order.placed_by_user_id
      ? getOrderPlacerProfile(order.placed_by_user_id)
      : Promise.resolve(null),
    order.status === "completed"
      ? getOrderReviewStatus(order.id, context.user.userId)
      : Promise.resolve({ sellerReviewed: false, reviewedProductItemIds: [] }),
  ]);

  const farmerName =
    order.farmer?.business_name || order.farmer?.full_name || "Local Producer";
  const isDelivery = order.fulfillment_type === "seller_delivery";
  const placedDate = new Date(order.created_at).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const formattedPickupDate = order.pickup_date
    ? formatPickupDate(order.pickup_date)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-6">
          {/* Back Navigation & Breadcrumb */}
          <div className="flex items-center justify-between">
            <Link
              href={routes.orders}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[36px]"
            >
              <RiArrowLeftLine className="size-4" aria-hidden="true" />
              Back to Orders
            </Link>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Active business:
              </span>
              <Badge variant="outline" className="text-xs font-medium">
                {context.business.name} ({context.role})
              </Badge>
            </div>
          </div>

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-xs font-mono font-medium text-muted-foreground">
                ORDER REFERENCE
              </p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                #{order.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Placed on {placedDate} · Ordered from{" "}
                <span className="font-semibold text-foreground">{farmerName}</span>
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap sm:self-center">
              <OrderStatusBadge status={order.status} />
              {order.status === "pending" && (
                <V4CancelOrderButton orderId={order.id} />
              )}
            </div>
          </div>

          {/* Contextual Next-Action Banner */}
          <V4OrderStatusBanner
            status={order.status}
            fulfillmentType={order.fulfillment_type}
            cancellationReason={order.cancellation_reason}
            pickupDate={formattedPickupDate}
            deliveryAddress={order.delivery_address}
            farmerName={farmerName}
          />

          {/* Order Progress Stepper */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-2xs">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Fulfillment Timeline
            </h2>
            <OrderProgress
              variant="compact"
              status={order.status}
              fulfillmentType={order.fulfillment_type}
              cancellationReason={order.cancellation_reason}
              className="border-0 bg-transparent p-0 shadow-none"
            />
          </div>

          {/* Two-Column Responsive Details Grid */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)] items-start">
            {/* Left Column: Line Items, Fulfillment, Placed-by, Chat */}
            <div className="flex flex-col gap-6">
              {/* Items Card */}
              <div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
                <div className="border-b border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    Items Ordered ({order.items?.length ?? 0})
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    Direct from producer
                  </span>
                </div>

                <div className="divide-y divide-border px-4">
                  {(order.items ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-3.5 text-sm"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="font-semibold text-foreground truncate">
                          {item.product_name ?? "Produce Item"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.quantity} {item.unit} × {CURRENCY}
                          {item.unit_price.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          / {item.unit}
                        </p>
                      </div>
                      <p className="font-semibold text-foreground tabular-nums shrink-0">
                        {CURRENCY}
                        {(item.subtotal ?? 0).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Subtotal / Total Summary */}
                <div className="border-t border-border bg-muted/20 px-4 py-3.5 flex items-center justify-between">
                  <span className="font-medium text-foreground">Order Total</span>
                  <span className="text-lg font-bold text-foreground tabular-nums">
                    {CURRENCY}
                    {(order.total_amount ?? 0).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Fulfillment Card */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                    {isDelivery ? (
                      <RiTruckLine className="size-5" aria-hidden="true" />
                    ) : (
                      <RiStore2Line className="size-5" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">
                        Fulfillment: {FULFILLMENT_LABELS[order.fulfillment_type]}
                      </h2>
                    </div>

                    {isDelivery && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <p className="text-xs font-medium text-foreground">
                          Delivery Address:
                        </p>
                        <p className="mt-0.5 text-foreground/90">
                          {order.delivery_address || "Standard business delivery address"}
                        </p>
                      </div>
                    )}

                    {!isDelivery && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <p className="text-xs font-medium text-foreground">
                          Scheduled Pickup Date:
                        </p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {formattedPickupDate || "To be confirmed with producer"}
                        </p>
                      </div>
                    )}

                    {order.notes && (
                      <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground block mb-0.5">
                          Order Instructions:
                        </span>
                        <p className="italic">&ldquo;{order.notes}&rdquo;</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Placed-By & Team Audit Card */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <RiShieldCheckLine className="size-4 text-primary" aria-hidden="true" />
                  Order Audit Trail
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      Buyer Business
                    </span>
                    <span className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                      <RiBuildingLine className="size-3.5 text-muted-foreground" />
                      {context.business.name}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground block">
                      Placed By Member
                    </span>
                    <span className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                      <RiUserLine className="size-3.5 text-muted-foreground" />
                      {placerProfile?.full_name || order.placed_by_user_id || "Active Team Member"}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground block">
                      Order Placed Timestamp
                    </span>
                    <span className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                      <RiTimeLine className="size-3.5 text-muted-foreground" />
                      {placedDate}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground block">
                      Your Access Level
                    </span>
                    <span className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {context.role}
                      </Badge>
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Coordination */}
              <div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    Coordinate with {farmerName}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Direct relationship messaging with order context attached.
                  </p>
                </div>
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Have questions about pickup times, delivery notes, or order adjustments? Open your direct conversation with the producer.
                  </p>
                  <OrderMessageAction
                    orderId={order.id}
                    label={`Message ${farmerName}`}
                    variant="default"
                    size="sm"
                    className="shrink-0 gap-1.5"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Producer Contact & Reviews */}
            <div className="flex flex-col gap-6">
              {/* Producer Information Card */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Producer Information
                </h2>

                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <RiPlantLine className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">
                      {farmerName}
                    </p>
                    {order.farmer?.city && (
                      <p className="text-xs text-muted-foreground">
                        {order.farmer.city}
                      </p>
                    )}
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2 text-sm">
                  {order.farmer?.phone ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Phone:</span>
                      <a
                        href={`tel:${order.farmer.phone}`}
                        className="font-medium text-primary hover:underline text-xs"
                      >
                        {order.farmer.phone}
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Contact:</span>
                      <span className="text-xs text-muted-foreground">In-app messaging</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">Marketplace:</span>
                    <Link
                      href={routes.producer(order.farmer_clerk_id)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View Producer Profile →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Order Reviews Panel (if completed) */}
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
        </div>
      </main>

      <MarketplaceFooter />
    </div>
  );
}
