"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSupabase } from "@/hooks/use-supabase";
import type { OrderStatus } from "@/lib/constants";

interface OrderStatusSnapshot {
  status: OrderStatus;
  cancellationReason: string | null;
}

/**
 * Subscribes to Supabase Realtime UPDATE events for a single `orders` row.
 *
 * Returns live `status` and `cancellationReason` that update automatically
 * when the farmer changes the order status — without a page reload.
 *
 * Mirrors the auth-token pattern already used by `OrderChat`:
 * - Refreshes Clerk JWT before joining the channel
 * - Cleans up the channel on unmount
 * - Ignores events for unrelated order IDs
 * - Handles subscription errors gracefully without crashing the page
 */
export function useOrderStatusSync(
  orderId: string,
  initialStatus: OrderStatus,
  initialCancellationReason: string | null = null
): OrderStatusSnapshot {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [cancellationReason, setCancellationReason] = useState<string | null>(
    initialCancellationReason
  );

  // Sync state when the server re-renders with fresh data (e.g. after router.refresh())
  const [prevOrderId, setPrevOrderId] = useState(orderId);
  const [prevInitialStatus, setPrevInitialStatus] = useState(initialStatus);
  if (orderId !== prevOrderId || initialStatus !== prevInitialStatus) {
    setPrevOrderId(orderId);
    setPrevInitialStatus(initialStatus);
    setStatus(initialStatus);
    setCancellationReason(initialCancellationReason);
  }

  const supabase = useSupabase();
  const { getToken } = useAuth();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isCancelled = false;

    async function initSubscription() {
      try {
        // Authenticate the Realtime WebSocket with the current Clerk JWT
        // so postgres_changes RLS policies can validate the request.
        const token = await getToken({ skipCache: true });
        if (isCancelled) return;

        if (token) {
          await supabase.realtime.setAuth(token);
        }
        if (isCancelled) return;

        channel = supabase
          .channel(`order-status:${orderId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "orders",
              filter: `id=eq.${orderId}`,
            },
            (payload) => {
              // Guard: only process events for this exact order
              const updated = payload.new as {
                id?: string;
                status?: string;
                cancellation_reason?: string | null;
              };

              if (!updated || updated.id !== orderId) return;

              if (updated.status) {
                setStatus(updated.status as OrderStatus);
              }
              if ("cancellation_reason" in updated) {
                setCancellationReason(updated.cancellation_reason ?? null);
              }
            }
          )
          .subscribe((_status, err) => {
            if (err) {
              console.warn(
                `[realtime] order-status subscription error on order ${orderId}:`,
                err
              );
            }
          });
      } catch (err) {
        console.warn(
          `[realtime] Failed to initialize order-status subscription for order ${orderId}:`,
          err
        );
      }
    }

    initSubscription();

    return () => {
      isCancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  // Re-subscribe only when the order ID or supabase client changes.
  }, [supabase, orderId, getToken]);

  return { status, cancellationReason };
}
