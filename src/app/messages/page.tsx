import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { requireActiveBusiness } from "@/platform/business-context";
import { getV4BusinessConversations } from "@/lib/supabase/queries/conversations";
import { V4MessagesContextBar } from "@/components/messages/v4-messages-context-bar";
import { V4ConversationsList } from "@/components/messages/v4-conversations-list";

export const metadata: Metadata = {
  title: "Messages — UMA Market",
  description: "Unified relationship communications between commercial buyers and local farm producers.",
};

export default async function MessagesPage() {
  let context;
  try {
    context = await requireActiveBusiness();
  } catch {
    redirect("/sign-in");
  }

  const conversations = await getV4BusinessConversations(context.business.id);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketplaceHeader />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Coordinate delivery schedules, pickup logistics, and product inquiries directly with your partners.
          </p>
        </div>

        <V4MessagesContextBar context={context} />

        <V4ConversationsList conversations={conversations} />
      </main>

      <MarketplaceFooter />
    </div>
  );
}
