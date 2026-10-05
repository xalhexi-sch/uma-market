import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Coordinate delivery schedules, pickup logistics, and product inquiries directly with your partners.
        </p>
      </div>

      <V4MessagesContextBar context={context} />

      <V4ConversationsList conversations={conversations} />
    </div>
  );
}
