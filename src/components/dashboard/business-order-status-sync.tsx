"use client";

import { useOrderStatusSync } from "@/hooks/use-order-status-sync";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderStatusTimeline } from "@/components/dashboard/order-status-timeline";
import { CancelOrderButton } from "@/components/dashboard/cancel-order-button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { OrderStatus, FulfillmentType } from "@/lib/constants";

interface BusinessOrderStatusSectionProps {
  orderId: string;
  farmerName: string;
  orderCreatedAt: string;
  placedDate?: string;
  initialStatus: OrderStatus;
  fulfillmentType: FulfillmentType;
  initialCancellationReason: string | null;
  itemsCount?: number;
  itemsContent?: React.ReactNode;
  fulfillmentContent?: React.ReactNode;
  contactContent?: React.ReactNode;
  chatContent?: React.ReactNode;
  /** Fallbacks for backwards compatibility */
  mainContent?: React.ReactNode;
  asideContent?: React.ReactNode;
}

/**
 * Client component that subscribes to Supabase Realtime UPDATE events for
 * a single `orders` row and re-renders both:
 *  - the header row (with live status badge + cancel button)
 *  - the full order progress timeline
 *  - the responsive workspace layout
 * without a page reload.
 *
 * Responsive layout:
 * - Desktop (lg+): Two-column grid (Left: Items + Fulfillment + Chat, Right: Timeline + Contact)
 * - Mobile (<lg): Timeline-first shadcn Tabs (Status & Info, Items, Chat) preventing scroll-trapping
 */
export function BusinessOrderStatusSection({
  orderId,
  farmerName,
  orderCreatedAt,
  placedDate,
  initialStatus,
  fulfillmentType,
  initialCancellationReason,
  itemsCount = 0,
  itemsContent,
  fulfillmentContent,
  contactContent,
  chatContent,
  mainContent,
  asideContent,
}: BusinessOrderStatusSectionProps) {
  const { status, cancellationReason } = useOrderStatusSync(
    orderId,
    initialStatus,
    initialCancellationReason
  );

  const displayDate =
    placedDate ??
    new Date(orderCreatedAt).toLocaleDateString("en-PH", {
      dateStyle: "long",
    });

  // Timeline node
  const timelineNode = (
    <OrderStatusTimeline
      status={status}
      fulfillmentType={fulfillmentType}
      cancellationReason={cancellationReason}
    />
  );

  // Resolved contents
  const resolvedItems = itemsContent ?? mainContent;
  const resolvedFulfillment = fulfillmentContent;
  const resolvedContact = contactContent ?? asideContent;
  const resolvedChat = chatContent;

  return (
    <>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div>
          <p className="text-xs text-muted-foreground font-mono">
            #{orderId.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold text-foreground">
            Order from {farmerName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Placed {displayDate}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <OrderStatusBadge status={status} />
          {status === "pending" && <CancelOrderButton orderId={orderId} />}
        </div>
      </div>

      {/* ── Mobile Layout (< lg) ────────────────────────── */}
      <div className="flex lg:hidden flex-col gap-4">
        {/* Segmented shadcn Tabs for mobile */}
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-11 p-1 bg-muted/60">
            <TabsTrigger value="status" className="text-xs font-medium">
              Status & Info
            </TabsTrigger>
            <TabsTrigger value="items" className="text-xs font-medium">
              Items {itemsCount > 0 ? `(${itemsCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs font-medium">
              Chat
            </TabsTrigger>
          </TabsList>

          {/* Status & Info: Timeline first, then fulfillment, then farmer contact */}
          <TabsContent value="status" className="flex flex-col gap-4 pt-2">
            {timelineNode}
            {resolvedFulfillment}
            {resolvedContact}
          </TabsContent>

          {/* Items: Full item breakdown */}
          <TabsContent value="items" className="pt-2">
            {resolvedItems}
          </TabsContent>

          {/* Chat: Dedicated chat interface without page scroll trap */}
          <TabsContent value="chat" className="pt-2">
            {resolvedChat}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Desktop Layout (lg+) ────────────────────────── */}
      <div className="hidden lg:grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left / main: Items + Fulfillment + Chat */}
        <div className="flex flex-col gap-6">
          {resolvedItems}
          {resolvedFulfillment}
          {resolvedChat}
        </div>

        {/* Right / aside: Timeline + Contact */}
        <div className="flex flex-col gap-6">
          {timelineNode}
          {resolvedContact}
        </div>
      </div>
    </>
  );
}
