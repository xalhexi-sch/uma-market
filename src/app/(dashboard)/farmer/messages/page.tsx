import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserConversations } from "@/lib/supabase/queries/messages";
import { ConversationsList } from "@/components/dashboard/conversations-list";

export const metadata = {
  title: "Messages — UMA Market",
  description: "Direct communications with commercial buyers regarding wholesale orders.",
};

export default async function FarmerMessagesPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId || sessionClaims?.user_role !== "farmer") {
    redirect("/sign-in");
  }

  const conversations = await getUserConversations(userId, "farmer");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Buyer Communications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Direct messages and coordination channels with commercial establishments purchasing your produce.
        </p>
      </div>

      <ConversationsList conversations={conversations} role="farmer" />
    </div>
  );
}
