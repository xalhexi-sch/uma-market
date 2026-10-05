"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiMessage2Line, RiLoader4Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { resolveOrderConversation } from "@/app/messages/actions";

interface OrderMessageActionProps {
  orderId: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function OrderMessageAction({
  orderId,
  label = "Message",
  variant = "ghost",
  size = "sm",
  className,
}: OrderMessageActionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpenChat() {
    setLoading(true);
    setError(null);

    try {
      const res = await resolveOrderConversation(orderId);
      if (!res.success) {
        setError(res.error);
        setLoading(false);
        return;
      }
      router.push(`/messages/${res.conversationId}?orderId=${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open conversation.");
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col">
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleOpenChat}
        disabled={loading}
        data-testid="order-message-button"
        className={className}
      >
        {loading ? (
          <RiLoader4Line className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RiMessage2Line className="mr-1.5 size-3.5 text-muted-foreground" aria-hidden="true" />
        )}
        {label}
      </Button>
      {error && (
        <span className="text-[11px] text-destructive mt-1" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
