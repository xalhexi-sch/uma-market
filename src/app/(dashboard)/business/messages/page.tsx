import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserConversations } from "@/lib/supabase/queries/messages";
import { ConversationsList } from "@/components/dashboard/conversations-list";

export const metadata = {
  title: "Messages — UMA Market",
  description: "Direct communications with local farm suppliers regarding your purchase orders.",
};

export default async function BusinessMessagesPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId || sessionClaims?.user_role !== "business") {
    redirect("/sign-in");
  }

  const conversations = await getUserConversations(userId, "business");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Coordinate delivery schedules, farm pickup instructions, and order adjustments directly with producers.
        </p>
      </div>

      <ConversationsList conversations={conversations} role="business" />
    </div>
  );
}
