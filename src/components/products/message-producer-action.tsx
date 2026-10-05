import { RiChat3Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";

/**
 * "Message producer" entry point on the product page.
 *
 * V4 messaging is ONE conversation per business relationship, with the product
 * attached only as optional context. That relationship-based conversation model
 * does not exist yet (migration-plan: unified messaging phase); today messages
 * are order-threaded only. We deliberately do NOT create a product-specific chat
 * or a placeholder route. Until unified messaging ships, the action is shown
 * disabled with an honest explanation. When it ships, wire `href` here to the
 * relationship conversation and pass `productId` as context.
 */
export function MessageProducerAction({ producerName }: { producerName: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        disabled
        aria-describedby="message-producer-note"
        className="w-full justify-center gap-2"
      >
        <RiChat3Line className="size-4" aria-hidden="true" />
        Message producer
      </Button>
      <p id="message-producer-note" className="text-xs leading-relaxed text-muted-foreground">
        Direct messaging with {producerName} is coming soon. For now, place an order and
        coordinate pickup or delivery in the order thread.
      </p>
    </div>
  );
}
