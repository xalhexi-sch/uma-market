"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RiTruckLine,
  RiStore2Line,
  RiMapPinLine,
  RiCalendarLine,
  RiCheckLine,
  RiCloseLine,
  RiTimeLine,
  RiArrowRightLine,
  RiUserLine,
  RiPhoneLine,
} from "@remixicon/react";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { OrderMessageAction } from "@/components/orders/order-message-action";
import { updateSellerOrderStatus } from "@/app/dashboard/orders/actions";
import type { Order } from "@/lib/types";

interface V4SellerOrderCardProps {
  order: Order;
}

const PRESET_DECLINE_REASONS = [
  "Harvest shortfall / out of stock",
  "Logistics constraint / delivery location unreachable",
  "Minimum volume threshold not viable",
  "Lead time too short / unable to meet schedule",
  "Other reason",
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function V4SellerOrderCard({ order }: V4SellerOrderCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isDeclineOpen, setIsDeclineOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState(PRESET_DECLINE_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const router = useRouter();

  const buyerName =
    order.business?.business_name || order.business?.full_name || "Wholesale Buyer";
  const buyerCity = order.business?.city || "";
  const buyerPhone = order.business?.phone || "";
  const orderRef = `UMA-${order.id.slice(0, 8).toUpperCase()}`;

  function handleTransition(newStatus: string, reason?: string) {
    startTransition(async () => {
      try {
        const res = await updateSellerOrderStatus(order.id, newStatus, reason);
        if (res.success) {
          toast.success(
            newStatus === "cancelled"
              ? "Order declined."
              : `Order status updated to ${newStatus.replace("_", " ")}.`
          );
          router.refresh();
        } else {
          toast.error(res.error ?? "Failed to update order status.");
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update order status.";
        toast.error(message);
      }
    });
  }

  function handleConfirmDecline() {
    const finalReason =
      selectedReason === "Other reason" && customReason.trim()
        ? `Other: ${customReason.trim()}`
        : selectedReason;

    setIsDeclineOpen(false);
    handleTransition("cancelled", finalReason);
  }

  // Contextual "What do I need to do next?" Guidance
  let nextActionGuidance = "";
  if (order.status === "pending") {
    nextActionGuidance = "New incoming order awaiting your review. Accept to confirm stock & begin fulfillment, or decline if unavailable.";
  } else if (order.status === "accepted") {
    nextActionGuidance = "Order is accepted. Begin harvesting, cleaning, and packing the produce.";
  } else if (order.status === "preparing") {
    nextActionGuidance = "Produce is being packed. Once crated and staged, mark as ready.";
  } else if (order.status === "ready") {
    nextActionGuidance =
      order.fulfillment_type === "seller_delivery"
        ? "Items are ready for transit. Dispatch order for delivery to buyer."
        : "Produce is ready at your facility. Awaiting buyer pickup.";
  } else if (order.status === "for_delivery") {
    nextActionGuidance = "Produce is out for delivery. Confirm once safely delivered to the buyer location.";
  } else if (order.status === "completed") {
    nextActionGuidance = "Order fulfilled and completed successfully.";
  } else if (order.status === "cancelled") {
    nextActionGuidance = `Order was cancelled. Reason: ${order.cancellation_reason || "No reason specified."}`;
  }

  return (
    <div
      data-testid={`seller-order-card-${order.id}`}
      className="flex flex-col rounded-xl border border-border bg-card shadow-2xs overflow-hidden transition-all hover:border-border/80"
    >
      {/* Order Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-sm font-bold text-foreground">
            {orderRef}
          </span>
          <span data-testid="seller-order-status-badge">
            <OrderStatusBadge status={order.status} />
          </span>
          <Badge variant="outline" className="text-[11px] capitalize flex items-center gap-1">
            {order.fulfillment_type === "seller_delivery" ? (
              <>
                <RiTruckLine className="size-3 text-primary" aria-hidden="true" />
                Delivery
              </>
            ) : (
              <>
                <RiStore2Line className="size-3 text-primary" aria-hidden="true" />
                Pickup
              </>
            )}
          </Badge>
        </div>

        <div className="text-xs text-muted-foreground">
          Placed {formatDate(order.created_at)}
        </div>
      </div>

      {/* Main Body */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Next step banner */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-foreground">
          <RiTimeLine className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-semibold text-foreground">Next Step: </span>
            <span className="text-muted-foreground">{nextActionGuidance}</span>
          </div>
        </div>

        {/* Counterparty & Logistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Buyer Details */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-1.5">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
              Buyer Details
            </span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <RiUserLine className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>{buyerName}</span>
            </div>
            {buyerCity && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <RiMapPinLine className="size-3.5" aria-hidden="true" />
                <span>{buyerCity}</span>
              </div>
            )}
            {buyerPhone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <RiPhoneLine className="size-3.5" aria-hidden="true" />
                <span>{buyerPhone}</span>
              </div>
            )}
          </div>

          {/* Fulfillment Logistics */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-1.5">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
              Fulfillment Logistics
            </span>
            {order.fulfillment_type === "seller_delivery" ? (
              <div className="flex items-start gap-1.5 text-muted-foreground">
                <RiMapPinLine className="size-3.5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <span>{order.delivery_address || "Delivery address provided by buyer."}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <RiCalendarLine className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                <span>Target Pickup Date: {order.pickup_date ? formatDate(order.pickup_date) : "Pending coordination"}</span>
              </div>
            )}
            {order.notes && (
              <p className="text-[11px] text-muted-foreground italic border-t border-border/40 pt-1.5 mt-1.5">
                Note from buyer: &ldquo;{order.notes}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Itemized Line Items Table */}
        <div className="space-y-2">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
            Ordered Produce Items
          </span>
          <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background/50 overflow-hidden text-xs">
            {order.items?.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 gap-2"
              >
                <div className="space-y-0.5">
                  <span className="font-semibold text-foreground">{item.product_name}</span>
                  <div className="text-muted-foreground text-[11px]">
                    {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                  </div>
                </div>
                <span className="font-semibold text-foreground">
                  {formatCurrency(item.subtotal)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-muted/20 font-bold text-sm text-foreground">
              <span>Total Wholesale Amount</span>
              <span className="text-primary">{formatCurrency(order.total_amount ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/60">
          <OrderMessageAction
            orderId={order.id}
            label="Message Buyer"
            variant="ghost"
            size="sm"
          />

          {/* Forward State Machine Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {order.status === "pending" && (
              <>
                <Button
                  data-testid="order-action-decline"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setIsDeclineOpen(true)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <RiCloseLine className="mr-1.5 size-3.5" aria-hidden="true" />
                  Decline
                </Button>
                <Button
                  data-testid="order-action-accept"
                  variant="default"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleTransition("accepted")}
                >
                  <RiCheckLine className="mr-1.5 size-3.5" aria-hidden="true" />
                  Accept Order
                </Button>
              </>
            )}

            {order.status === "accepted" && (
              <Button
                data-testid="order-action-preparing"
                variant="default"
                size="sm"
                disabled={isPending}
                onClick={() => handleTransition("preparing")}
              >
                Start Preparing
                <RiArrowRightLine className="ml-1.5 size-3.5" aria-hidden="true" />
              </Button>
            )}

            {order.status === "preparing" && (
              <Button
                data-testid="order-action-ready"
                variant="default"
                size="sm"
                disabled={isPending}
                onClick={() => handleTransition("ready")}
                >
                {order.fulfillment_type === "seller_delivery" ? "Mark Ready for Delivery" : "Mark Ready for Pickup"}
                <RiCheckLine className="ml-1.5 size-3.5" aria-hidden="true" />
              </Button>
            )}

            {order.status === "ready" && order.fulfillment_type === "seller_delivery" && (
              <Button
                data-testid="order-action-delivery"
                variant="default"
                size="sm"
                disabled={isPending}
                onClick={() => handleTransition("for_delivery")}
              >
                <RiTruckLine className="mr-1.5 size-3.5" aria-hidden="true" />
                Out for Delivery
              </Button>
            )}

            {order.status === "ready" && order.fulfillment_type === "pickup" && (
              <Button
                data-testid="order-action-complete"
                variant="default"
                size="sm"
                disabled={isPending}
                onClick={() => handleTransition("completed")}
                >
                <RiCheckLine className="mr-1.5 size-3.5" aria-hidden="true" />
                Mark as Picked Up
              </Button>
            )}

            {order.status === "for_delivery" && (
              <Button
                data-testid="order-action-complete"
                variant="default"
                size="sm"
                disabled={isPending}
                onClick={() => handleTransition("completed")}
                >
                <RiCheckLine className="mr-1.5 size-3.5" aria-hidden="true" />
                Mark as Delivered
              </Button>
            )}

            {order.status === "ready" && order.fulfillment_type === "pickup" && (
              <Button
                data-testid={`action-completed-pickup-${order.id}`}
                variant="default"
                size="sm"
                disabled={isPending}
                onClick={() => handleTransition("completed")}
                >
                <RiCheckLine className="mr-1.5 size-3.5" aria-hidden="true" />
                Mark as Picked Up
              </Button>
            )}

            {order.status === "for_delivery" && (
              <Button
                data-testid={`action-completed-delivery-${order.id}`}
                variant="default"
                size="sm"
                disabled={isPending}
                onClick={() => handleTransition("completed")}
                >
                <RiCheckLine className="mr-1.5 size-3.5" aria-hidden="true" />
                Mark as Delivered
              </Button>
            )}

            {order.status === "completed" && (
              <span className="text-xs font-semibold text-primary flex items-center gap-1">
                <RiCheckLine className="size-4" aria-hidden="true" />
                Fulfilled
              </span>
            )}

            {order.status === "cancelled" && (
              <span className="text-xs font-semibold text-destructive flex items-center gap-1">
                <RiCloseLine className="size-4" aria-hidden="true" />
                Cancelled
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Decline Reason Modal Dialog */}
      <Dialog open={isDeclineOpen} onOpenChange={setIsDeclineOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline Wholesale Order</DialogTitle>
            <DialogDescription>
              Please specify the reason for declining order {orderRef}. This will be communicated clearly to {buyerName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            {PRESET_DECLINE_REASONS.map((reason) => (
              <label
                key={reason}
                className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer rounded-lg border border-border p-2.5 hover:bg-muted/40 transition-colors"
              >
                <input
                  type="radio"
                  name="declineReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="size-3.5 text-primary focus:ring-primary"
                />
                <span>{reason}</span>
              </label>
            ))}

            {selectedReason === "Other reason" && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Provide a clear, respectful reason for declining..."
                rows={3}
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeclineOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending || (selectedReason === "Other reason" && !customReason.trim())}
              onClick={handleConfirmDecline}
            >
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
