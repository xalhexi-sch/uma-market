"use client";

import { useOrderStatusSync } from "@/hooks/use-order-status-sync";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderStatusActions } from "@/components/dashboard/order-status-actions";
import { OrderProgressSteps } from "@/components/dashboard/order-progress-steps";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { OrderStatus, FulfillmentType } from "@/lib/constants";

interface FarmerOrderStatusSectionProps {
  orderId: string;
  bizName: string;
  orderCreatedAt: string;
  placedDate?: string;
  initialStatus: OrderStatus;
  initialCancellationReason: string | null;
  fulfillmentType: FulfillmentType;
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
 * Client component that subscribes to Supabase Realtime order UPDATE events
 * and re-renders the header row (with status badge) and the status action buttons
 * live — without a page reload.
 *
 * Responsive layout:
 * - Desktop (lg+): Two-column grid (Left: Items + Fulfillment, Right: Actions + Progress + Contact + Chat)
 * - Mobile (<lg): Immediate top action card for zero-scroll response + shadcn Tabs (Overview, Items, Chat)
 */
export function FarmerOrderStatusSection({
  orderId,
  bizName,
  orderCreatedAt,
  placedDate,
  initialStatus,
  initialCancellationReason,
  fulfillmentType,
  itemsCount = 0,
  itemsContent,
  fulfillmentContent,
  contactContent,
  chatContent,
  mainContent,
  asideContent,
}: FarmerOrderStatusSectionProps) {
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

  const isActionable = status !== "completed" && status !== "cancelled";

  // Shared progress steps box
  const progressBox =
    status === "cancelled" ? (
      <OrderProgressSteps
        status={status}
        fulfillmentType={fulfillmentType}
        cancellationReason={cancellationReason}
      />
    ) : (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <p className="text-sm font-medium text-foreground mb-3">Order Progress</p>
        <OrderProgressSteps
          status={status}
          fulfillmentType={fulfillmentType}
          cancellationReason={cancellationReason}
        />
      </div>
    );

  // Resolved contents
  const resolvedItems = itemsContent ?? mainContent;
  const resolvedFulfillment = fulfillmentContent;
  const resolvedContact = contactContent ?? asideContent;
  const resolvedChat = chatContent;

  return (
    <>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground font-mono">
            #{orderId.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold text-foreground">
            Order from {bizName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Placed {displayDate}
          </p>
        </div>
        <div className="shrink-0 pt-0.5">
          <OrderStatusBadge status={status} />
        </div>
      </div>

      {/* ── Mobile Layout (< lg) ────────────────────────── */}
      <div className="flex lg:hidden flex-col gap-4">
        {/* Urgent Action Card right at the top on mobile so farmer never scrolls past items */}
        {isActionable && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <OrderStatusActions
              orderId={orderId}
              currentStatus={status}
              fulfillmentType={fulfillmentType}
            />
          </div>
        )}

        {/* Segmented shadcn Tabs for mobile */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-11 p-1 bg-muted/60">
            <TabsTrigger value="overview" className="text-xs font-medium">
              Overview
            </TabsTrigger>
            <TabsTrigger value="items" className="text-xs font-medium">
              Items {itemsCount > 0 ? `(${itemsCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs font-medium">
              Chat
            </TabsTrigger>
          </TabsList>

          {/* Overview: Fulfillment instructions + Progress + Contact */}
          <TabsContent value="overview" className="flex flex-col gap-4 pt-2">
            {resolvedFulfillment}
            {progressBox}
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
        {/* Left / main: Items + Fulfillment */}
        <div className="flex flex-col gap-6">
          {resolvedItems}
          {resolvedFulfillment}
        </div>

        {/* Right / aside: Actions + Progress + Contact + Chat */}
        <div className="flex flex-col gap-6">
          {/* Farmer action buttons — driven by live status */}
          <OrderStatusActions
            orderId={orderId}
            currentStatus={status}
            fulfillmentType={fulfillmentType}
          />

          {progressBox}

          {resolvedContact}

          {resolvedChat}
        </div>
      </div>
    </>
  );
}
