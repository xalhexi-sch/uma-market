"use client";

import { useState, useRef, useEffect } from "react";
import { RiSendPlane2Line, RiMessage2Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMessage } from "@/app/(dashboard)/messages/actions";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

interface OrderChatProps {
  orderId: string;
  currentUserId: string;
  initialMessages: Message[];
  counterpartyName: string;
}

export function OrderChat({
  orderId,
  currentUserId,
  initialMessages,
  counterpartyName,
}: OrderChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [prevInitial, setPrevInitial] = useState(initialMessages);
  if (initialMessages !== prevInitial) {
    setPrevInitial(initialMessages);
    setMessages(initialMessages);
  }
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || sending) return;

    setSending(true);
    setError(null);

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      order_id: orderId,
      sender_clerk_id: currentUserId,
      body: clean,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");

    const res = await sendMessage(orderId, clean);
    setSending(false);

    if (!res.success) {
      setError(res.error ?? "Failed to send message.");
      // Rollback optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  }

  return (
    <div className="flex flex-col h-[420px] rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-muted/30">
        <RiMessage2Line className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Order Communications
        </h3>
        <span className="text-xs text-muted-foreground ml-auto">
          Talking with {counterpartyName}
        </span>
      </div>

      {/* Message History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
            <RiMessage2Line className="size-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1 max-w-xs">
              Coordinate delivery timing, pickup locations, or order instructions directly with {counterpartyName}.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_clerk_id === currentUserId;
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={msg.id}
                className={cn("flex flex-col max-w-[80%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}
              >
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm",
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted text-foreground rounded-bl-none"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 px-1">
                  {timeStr}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div className="px-4 py-1.5 bg-destructive/10 text-destructive text-xs border-t border-destructive/20">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-border bg-background">
        <Input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message or delivery update..."
          disabled={sending}
          className="flex-1 text-sm h-10"
        />
        <Button type="submit" size="sm" disabled={!text.trim() || sending} className="h-10 px-4">
          <RiSendPlane2Line className="size-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
