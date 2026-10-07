"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiChat3Line, RiLoader4Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { resolveProductConversation, resolveProducerConversation } from "@/app/messages/actions";

interface MessageProducerActionProps {
  producerName: string;
  productId?: string;
  producerId?: string;
}

/**
 * "Message producer" entry point on product and producer profile pages.
 *
 * Resolves or creates the canonical relationship conversation between the
 * active buyer business and the producer business, passing the product context.
 */
export function MessageProducerAction({
  producerName,
  productId,
  producerId,
}: MessageProducerActionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMessage() {
    setLoading(true);
    setError(null);

    try {
      if (productId) {
        const res = await resolveProductConversation(productId);
        if (!res.success) {
          setError(res.error);
          setLoading(false);
          return;
        }
        router.push(`/messages/${res.conversationId}?productId=${productId}`);
      } else if (producerId) {
        const res = await resolveProducerConversation(producerId);
        if (!res.success) {
          setError(res.error);
          setLoading(false);
          return;
        }
        router.push(`/messages/${res.conversationId}`);
      } else {
        router.push("/messages");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open conversation.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <Button
        type="button"
        variant="outline"
        onClick={handleMessage}
        disabled={loading}
        data-testid="message-producer-button"
        // WCAG 2.5.3 Label in Name: the accessible name starts with the visible label.
        aria-label={`Message producer — ${producerName}`}
        className="w-full justify-center gap-2"
      >
        {loading ? (
          <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <RiChat3Line className="size-4" aria-hidden="true" />
        )}
        Message producer
      </Button>
      {error ? (
        <p className="text-xs text-destructive leading-relaxed" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Direct messaging with {producerName}. Inquiries and order coordination are organized in your business inbox.
        </p>
      )}
    </div>
  );
}
