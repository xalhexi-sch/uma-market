import type { Metadata } from "next";
import { RiNotification3Line } from "@remixicon/react";
import { NotificationList } from "./notification-list";
import { getNotifications } from "@/lib/supabase/queries/notifications";

export const metadata: Metadata = {
  title: "Notifications | UMA Market",
  description: "Updates about your UMA orders, messages, and marketplace activity.",
};

export default async function NotificationsPage() {
  const notifications = await getNotifications();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <RiNotification3Line className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep up with updates about your orders and conversations.
          </p>
        </div>
      </header>

      <NotificationList initialItems={notifications} />
    </div>
  );
}
