"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiCloseCircleLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import { cancelOrder } from "@/app/(dashboard)/business/orders/actions";

interface CancelOrderButtonProps {
  orderId: string;
}

export function CancelOrderButton({ orderId }: CancelOrderButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleCancel() {
    setIsPending(true);
    const result = await cancelOrder(orderId);
    setIsPending(false);

    if (result.success) {
      toast.success("Order cancelled successfully.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not cancel order.");
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
          />
        }
      >
        <RiCloseCircleLine className="size-4" />
        Cancel Order
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel order #{orderId.slice(0, 8).toUpperCase()} and notify the farmer.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Order</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Cancelling…" : "Yes, Cancel Order"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
