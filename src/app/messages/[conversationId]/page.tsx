import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RiArrowLeftLine, RiPlantLine, RiStoreLine } from "@remixicon/react";
import { requireActiveBusiness } from "@/platform/business-context";
import { createClient } from "@/lib/supabase/server";
import {
  getV4Conversation,
  getV4ConversationMessages,
} from "@/lib/supabase/queries/conversations";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { V4ConversationThread } from "@/components/messages/v4-conversation-thread";
import { Badge } from "@/components/ui/badge";

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ productId?: string; orderId?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ConversationPageProps): Promise<Metadata> {
  const { conversationId } = await params;
  return {
    title: `Conversation — UMA Market`,
    description: `Direct conversation workspace #${conversationId.slice(0, 8)}`,
  };
}

export default async function ConversationPage({
  params,
  searchParams,
}: ConversationPageProps) {
  const { conversationId } = await params;
  const { productId, orderId } = await searchParams;

  let context;
  try {
    context = await requireActiveBusiness();
  } catch {
    redirect("/sign-in");
  }

  const conversation = await getV4Conversation(conversationId, context.business.id);
  if (!conversation) {
    notFound();
  }

  const initialMessages = await getV4ConversationMessages(conversationId);

  // Optional: load product context preview if productId was provided in query
  let initialProductContext = null;
  if (productId) {
    const supabase = await createClient();
    const { data: prod } = await supabase
      .from("products")
      .select("id, name, price_per_unit, unit, image_url")
      .eq("id", productId)
      .maybeSingle();
    if (prod) {
      initialProductContext = prod;
    }
  }

  // Optional: load order context preview if orderId was provided in query
  let initialOrderContext = null;
  if (orderId) {
    const supabase = await createClient();
    const { data: ord } = await supabase
      .from("orders")
      .select("id, status, total_amount")
      .eq("id", orderId)
      .maybeSingle();
    if (ord) {
      initialOrderContext = {
        id: ord.id,
        status: ord.status,
        total_amount: Number(ord.total_amount),
      };
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketplaceHeader />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 flex flex-col gap-4">
        {/* Navigation Header */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/70">
          <div className="flex items-center gap-3">
            <Link
              href="/messages"
              className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Back to all conversations"
            >
              <RiArrowLeftLine className="size-4" aria-hidden="true" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-foreground flex items-center gap-1.5">
                  {conversation.counterparty.canSell ? (
                    <RiPlantLine className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <RiStoreLine className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  )}
                  <span>{conversation.counterparty.name}</span>
                </h1>
                {conversation.counterparty.canSell ? (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs">
                    Producer
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400 text-xs">
                    Buyer
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Representing <span className="font-medium text-foreground">{context.business.name}</span> ({context.role})
              </p>
            </div>
          </div>
        </div>

        {/* Main Conversation Thread Component */}
        <V4ConversationThread
          conversationId={conversationId}
          activeBusinessId={context.business.id}
          currentUserId={context.user.userId}
          counterpartyName={conversation.counterparty.name}
          initialMessages={initialMessages}
          initialProductId={productId}
          initialOrderId={orderId}
          initialProductContext={initialProductContext}
          initialOrderContext={initialOrderContext}
        />
      </main>

      <MarketplaceFooter />
    </div>
  );
}
