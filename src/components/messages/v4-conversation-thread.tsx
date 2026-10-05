"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  RiSendPlane2Line,
  RiMessage2Line,
  RiShoppingBag3Line,
  RiFileList3Line,
  RiCloseLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSupabase } from "@/hooks/use-supabase";
import { sendV4Message } from "@/app/messages/actions";
import { V4ProductContextCard } from "./v4-product-context-card";
import { V4OrderContextCard } from "./v4-order-context-card";
import type { Message } from "@/lib/types";

interface V4ConversationThreadProps {
  conversationId: string;
  activeBusinessId: string;
  currentUserId: string;
  counterpartyName: string;
  initialMessages: Message[];
  initialProductId?: string | null;
  initialOrderId?: string | null;
  initialProductContext?: {
    id: string;
    name: string;
    price_per_unit: number;
    unit: string;
    image_url?: string | null;
  } | null;
  initialOrderContext?: {
    id: string;
    status: string;
    total_amount: number;
  } | null;
}

export function V4ConversationThread({
  conversationId,
  activeBusinessId,
  currentUserId,
  counterpartyName,
  initialMessages,
  initialProductId,
  initialOrderId,
  initialProductContext,
  initialOrderContext,
}: V4ConversationThreadProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [prevInitial, setPrevInitial] = useState(initialMessages);
  if (initialMessages !== prevInitial) {
    setPrevInitial(initialMessages);
    setMessages(initialMessages);
  }

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active context to attach to the NEXT message sent
  const [attachedProductId, setAttachedProductId] = useState<string | null>(
    initialProductId ?? null
  );
  const [attachedProduct, setAttachedProduct] = useState(initialProductContext ?? null);

  const [attachedOrderId, setAttachedOrderId] = useState<string | null>(
    initialOrderId ?? null
  );
  const [attachedOrder, setAttachedOrder] = useState(initialOrderContext ?? null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = useSupabase();
  const { getToken } = useAuth();

  // Supabase Realtime subscription for conversation messages
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isCancelled = false;

    async function initSubscription() {
      try {
        const token = await getToken({ skipCache: true });
        if (isCancelled) return;

        if (token) {
          await supabase.realtime.setAuth(token);
        }
        if (isCancelled) return;

        channel = supabase
          .channel(`v4-conversation:${conversationId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${conversationId}`,
            },
            async (payload) => {
              const newMsg = payload.new as Message;
              if (!newMsg || !newMsg.id) return;

              // Check if we need to enrich product or order context for the realtime message
              let enrichedProduct = null;
              if (newMsg.product_id) {
                const { data: p } = await supabase
                  .from("products")
                  .select("id, name, price_per_unit, unit, image_url")
                  .eq("id", newMsg.product_id)
                  .maybeSingle();
                enrichedProduct = p;
              }

              let enrichedOrder = null;
              if (newMsg.order_id) {
                const { data: o } = await supabase
                  .from("orders")
                  .select("id, status, total_amount")
                  .eq("id", newMsg.order_id)
                  .maybeSingle();
                if (o) {
                  enrichedOrder = {
                    id: o.id,
                    status: o.status,
                    total_amount: Number(o.total_amount),
                  };
                }
              }

              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) {
                  return prev;
                }

                // Replace optimistic message if matching
                const optimisticIndex = prev.findIndex(
                  (m) =>
                    m.id.startsWith("temp-") &&
                    m.sender_clerk_id === newMsg.sender_clerk_id &&
                    m.body === newMsg.body
                );

                const finalMsg: Message = {
                  ...newMsg,
                  product: enrichedProduct,
                  order: enrichedOrder,
                };

                if (optimisticIndex !== -1) {
                  const next = [...prev];
                  next[optimisticIndex] = finalMsg;
                  return next;
                }

                return [...prev, finalMsg];
              });
            }
          )
          .subscribe((status, err) => {
            if (err) {
              console.warn(`[realtime] Subscription error on conversation ${conversationId}:`, err);
            }
          });
      } catch (err) {
        console.warn(`[realtime] Failed to initialize subscription on conversation ${conversationId}:`, err);
      }
    }

    initSubscription();

    return () => {
      isCancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, conversationId, getToken]);

  // Scroll to bottom on updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();

    const clean = text.trim();
    if (!clean || sending) return;

    setSending(true);
    setError(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_clerk_id: currentUserId,
      sender_business_id: activeBusinessId,
      body: clean,
      created_at: new Date().toISOString(),
      product_id: attachedProductId,
      order_id: attachedOrderId,
      product: attachedProduct,
      order: attachedOrder,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setText("");

    const res = await sendV4Message({
      conversationId,
      body: clean,
      productId: attachedProductId,
      orderId: attachedOrderId,
    });

    setSending(false);

    if (!res.success) {
      // Rollback optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(clean);
      setError(res.error ?? "Failed to send message.");
      return;
    }

    // Clear one-time context attachments after successful dispatch
    setAttachedProductId(null);
    setAttachedProduct(null);
    setAttachedOrderId(null);
    setAttachedOrder(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[650px] max-h-[80vh] rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      {/* Thread Header */}
      <div className="border-b border-border bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>{counterpartyName}</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Direct business relationship messages and order coordination
          </p>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        data-testid="conversation-messages-container"
        className="flex-1 overflow-y-auto p-4 space-y-4"
        tabIndex={0}
        aria-label={`Message history with ${counterpartyName}`}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <RiMessage2Line className="size-10 text-muted-foreground/40 mb-2" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Start coordinating orders, delivery instructions, or product inquiries below.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_business_id
              ? msg.sender_business_id === activeBusinessId
              : msg.sender_clerk_id === currentUserId;

            return (
              <div
                key={msg.id}
                data-testid="message-item"
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 space-y-2.5 text-sm shadow-2xs ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-xs"
                      : "bg-muted/80 text-foreground border border-border/60 rounded-bl-xs"
                  }`}
                >
                  {/* Sender Header */}
                  <div className="flex items-center gap-2 text-[11px] opacity-80">
                    <span className="font-semibold">
                      {isMe ? "You" : msg.sender?.full_name || counterpartyName}
                    </span>
                    <span>•</span>
                    <time dateTime={msg.created_at}>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>

                  {/* Attached Product Context */}
                  {msg.product && (
                    <div className="pt-0.5">
                      <V4ProductContextCard product={msg.product} />
                    </div>
                  )}

                  {/* Attached Order Context */}
                  {msg.order && (
                    <div className="pt-0.5">
                      <V4OrderContextCard order={msg.order} />
                    </div>
                  )}

                  {/* Body Text */}
                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {msg.body}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Error alert if send failed */}
      {error && (
        <div
          role="alert"
          className="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive flex items-center justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-destructive/80 hover:text-destructive"
          >
            <RiCloseLine className="size-4" aria-hidden="true" />
            <span className="sr-only">Dismiss</span>
          </button>
        </div>
      )}

      {/* Pending Context Banner (to be attached to next message) */}
      {(attachedProduct || attachedOrder) && (
        <div className="border-t border-border bg-muted/40 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">Attaching to next message:</span>
            {attachedProduct && (
              <Badge variant="secondary" className="gap-1 font-normal">
                <RiShoppingBag3Line className="size-3 text-primary" aria-hidden="true" />
                <span>Listing: {attachedProduct.name}</span>
              </Badge>
            )}
            {attachedOrder && (
              <Badge variant="secondary" className="gap-1 font-normal">
                <RiFileList3Line className="size-3 text-primary" aria-hidden="true" />
                <span>Order #{attachedOrder.id.slice(0, 8).toUpperCase()}</span>
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setAttachedProductId(null);
              setAttachedProduct(null);
              setAttachedOrderId(null);
              setAttachedOrder(null);
            }}
            className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-0.5"
          >
            <RiCloseLine className="size-3.5" aria-hidden="true" />
            Remove context
          </button>
        </div>
      )}

      {/* Message Composer */}
      <form onSubmit={handleSend} className="p-3 border-t border-border bg-background flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            data-testid="message-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${counterpartyName}... (Press Enter to send)`}
            className="min-h-[44px] max-h-32 resize-none text-sm py-2.5"
            rows={1}
            disabled={sending}
          />
          <Button
            type="submit"
            data-testid="message-send-btn"
            disabled={!text.trim() || sending}
            size="default"
            className="min-h-[44px] px-4 shrink-0 gap-1.5"
          >
            <RiSendPlane2Line className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
