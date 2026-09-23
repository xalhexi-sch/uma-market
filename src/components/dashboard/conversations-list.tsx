import Link from "next/link";
import {
  RiMessage2Line,
  RiArrowRightLine,
  RiStoreLine,
  RiPlantLine,
  RiTimeLine,
} from "@remixicon/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/supabase/queries/messages";
import type { OrderStatus } from "@/lib/constants";

interface ConversationsListProps {
  conversations: Conversation[];
  role: "business" | "farmer";
}

export function ConversationsList({ conversations, role }: ConversationsListProps) {
  const isBusiness = role === "business";

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
        <RiMessage2Line className="size-12 text-muted-foreground/40 mb-3" />
        <h3 className="text-base font-medium text-foreground">No conversations yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {isBusiness
            ? "When you place an order with a local farm, an order-specific communication channel will appear here."
            : "When commercial buyers submit orders to your farm, order-specific communication threads will appear here."}
        </p>
        <Link
          href={isBusiness ? "/business/products" : "/farmer/products"}
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "mt-4",
          })}
        >
          {isBusiness ? "Browse Marketplace" : "Manage Products"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conv) => {
        const orderHref = `/${role}/orders/${conv.orderId}`;
        const timeAgo = conv.lastMessage
          ? new Date(conv.lastMessage.createdAt).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : null;

        return (
          <Card key={conv.orderId} className="border-border bg-card transition-colors hover:border-primary/40">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                      {isBusiness ? (
                        <RiPlantLine className="size-4 text-emerald-600" />
                      ) : (
                        <RiStoreLine className="size-4 text-amber-600" />
                      )}
                      {conv.counterpartyBusiness || conv.counterpartyName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({conv.orderNumber})
                    </span>
                    <OrderStatusBadge status={conv.status as OrderStatus} />
                    <Badge variant="outline" className="capitalize text-[11px]">
                      {conv.fulfillmentType === "seller_delivery" ? "Delivery" : "Pickup"}
                    </Badge>
                  </div>

                  {conv.lastMessage ? (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      <span className="font-medium text-foreground/80">Latest: </span>
                      {conv.lastMessage.body}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No messages yet — click below to coordinate order details.
                    </p>
                  )}

                  {timeAgo && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <RiTimeLine className="size-3" />
                      <span>{timeAgo}</span>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center">
                  <Link
                    href={orderHref}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "gap-1.5 text-xs font-medium"
                    )}
                  >
                    <span>Open Conversation</span>
                    <RiArrowRightLine className="size-3.5" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
