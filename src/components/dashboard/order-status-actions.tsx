"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { updateOrderStatus } from "@/app/(dashboard)/farmer/orders/actions";
import type { OrderStatus } from "@/lib/constants";

interface OrderStatusActionsProps {
  orderId: string;
  currentStatus: OrderStatus;
}

const NEXT_ACTIONS: Partial<Record<OrderStatus, Array<{ label: string; status: string; variant?: "default" | "outline" | "destructive" }>>> = {
  pending: [
    { label: "Accept Order", status: "accepted", variant: "default" },
    { label: "Decline", status: "cancelled", variant: "destructive" },
  ],
  accepted: [
    { label: "Mark as Preparing", status: "preparing", variant: "default" },
  ],
  preparing: [
    { label: "Mark as Ready", status: "ready", variant: "default" },
  ],
  ready: [
    { label: "Out for Delivery", status: "for_delivery", variant: "default" },
    { label: "Mark Completed (Pickup)", status: "completed", variant: "outline" },
  ],
  for_delivery: [
    { label: "Mark as Delivered", status: "completed", variant: "default" },
  ],
};

const PRESET_REASONS = [
  "Harvest shortfall / out of stock",
  "Logistics constraint / delivery location unreachable",
  "Pricing or minimum order discrepancy",
  "Buyer requested cancellation",
  "Other reason",
];

export function OrderStatusActions({ orderId, currentStatus }: OrderStatusActionsProps) {
  const actions = NEXT_ACTIONS[currentStatus];
  const [error, setError] = useState<string | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState(PRESET_REASONS[0]);
  const [customNote, setCustomNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!actions || actions.length === 0) return null;

  function handleAction(newStatus: string, reason?: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, newStatus, reason);
      if (result.success) {
        toast.success(newStatus === "cancelled" ? "Order declined." : "Order status updated.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not update order.");
        setError(result.error ?? "Could not update order.");
      }
    });
  }

  function handleButtonClick(status: string) {
    if (status === "cancelled") {
      setIsCancelDialogOpen(true);
      return;
    }
    handleAction(status);
  }

  function handleConfirmDecline() {
    const finalReason =
      selectedReason === "Other reason" && customNote.trim()
        ? `Other: ${customNote.trim()}`
        : selectedReason;

    setIsCancelDialogOpen(false);
    handleAction("cancelled", finalReason);
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <p className="text-sm font-medium text-foreground">Update Status</p>
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <Button
              key={action.status}
              variant={action.variant === "destructive" ? "destructive" : action.variant ?? "default"}
              size="sm"
              disabled={isPending}
              onClick={() => handleButtonClick(action.status)}
            >
              {isPending ? "Updating…" : action.label}
            </Button>
          ))}
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Structured Cancellation / Rejection Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline / Cancel Order</DialogTitle>
            <DialogDescription>
              Please select a structured reason for declining this wholesale order. This reason will be recorded on the order and visible to the commercial buyer.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cancellation Reason
            </label>
            <div className="flex flex-col gap-2">
              {PRESET_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-sm cursor-pointer transition-colors ${
                    selectedReason === reason
                      ? "border-primary bg-primary/5 text-foreground font-medium"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancellationReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="text-primary focus:ring-primary size-4"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {selectedReason === "Other reason" && (
              <div className="mt-2 flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">
                  Please specify details:
                </label>
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Provide additional context for the commercial buyer…"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCancelDialogOpen(false)}
              disabled={isPending}
            >
              Keep Order
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDecline}
              disabled={isPending || (selectedReason === "Other reason" && !customNote.trim())}
            >
              {isPending ? "Declining…" : "Confirm Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
