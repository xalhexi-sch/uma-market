import Link from "next/link";
import {
  RiMessage2Line,
  RiArrowRightLine,
  RiStoreLine,
  RiPlantLine,
  RiShoppingBag3Line,
  RiFileList3Line,
  RiTimeLine,
} from "@remixicon/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { DetailedV4Conversation } from "@/lib/supabase/queries/conversations";

interface V4ConversationsListProps {
  conversations: DetailedV4Conversation[];
}

export function V4ConversationsList({ conversations }: V4ConversationsListProps) {
  if (conversations.length === 0) {
    return (
      <div
        data-testid="messages-empty-state"
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-12 text-center"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
          <RiMessage2Line className="size-7" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No conversations yet</h3>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
          UMA provides one unified conversation per business relationship. When you message a producer about a listing or coordinate an order, your entire relationship history will be organized here.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <Link
            href="/products"
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            Browse Marketplace
          </Link>
          <Link
            href="/orders"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" role="feed" aria-label="Business Conversations">
      {conversations.map((conv) => {
        const timeAgo = conv.lastMessage
          ? new Date(conv.lastMessage.createdAt).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : new Date(conv.lastMessageAt).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            });

        return (
          <Link
            key={conv.id}
            href={`/messages/${conv.id}`}
            className="group block rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="border-border bg-card transition-all duration-200 hover:border-primary/50 hover:shadow-xs group-focus-visible:border-primary">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-1.5">
                        {conv.counterparty.canSell ? (
                          <RiPlantLine className="size-4 text-primary shrink-0" aria-hidden="true" />
                        ) : (
                          <RiStoreLine className="size-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                        )}
                        <span className="truncate">{conv.counterparty.name}</span>
                      </span>

                      {conv.counterparty.canSell ? (
                        <Badge variant="outline" className="border-primary/30 text-primary dark:text-primary-foreground text-[11px]">
                          Producer
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-border/60 text-muted-foreground text-[11px]">
                          Buyer
                        </Badge>
                      )}

                      {conv.lastMessage?.productId && (
                        <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
                          <RiShoppingBag3Line className="size-3" aria-hidden="true" />
                          Listing context
                        </Badge>
                      )}

                      {conv.lastMessage?.orderId && (
                        <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
                          <RiFileList3Line className="size-3" aria-hidden="true" />
                          Order context
                        </Badge>
                      )}
                    </div>

                    {conv.lastMessage ? (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        <span className="font-medium text-foreground/80">Latest: </span>
                        {conv.lastMessage.body}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No messages yet — click to begin conversation.
                      </p>
                    )}

                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-0.5">
                      <RiTimeLine className="size-3 shrink-0" aria-hidden="true" />
                      <span>{timeAgo}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-end sm:justify-center">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:translate-x-0.5 transition-transform duration-150">
                      Open
                      <RiArrowRightLine className="size-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
