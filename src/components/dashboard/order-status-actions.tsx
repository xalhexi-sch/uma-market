"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

export function OrderStatusActions({ orderId, currentStatus }: OrderStatusActionsProps) {
  const actions = NEXT_ACTIONS[currentStatus];
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!actions || actions.length === 0) return null;

  function handleAction(newStatus: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, newStatus);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Could not update order.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <p className="text-sm font-medium text-foreground">Update Status</p>
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <Button
            key={action.status}
            variant={action.variant === "destructive" ? "destructive" : action.variant ?? "default"}
            size="sm"
            disabled={isPending}
            onClick={() => handleAction(action.status)}
          >
            {isPending ? "Updating…" : action.label}
          </Button>
        ))}
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
