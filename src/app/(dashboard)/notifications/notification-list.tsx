"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RiCheckDoubleLine, RiNotification3Line } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import type { Notification } from "@/lib/supabase/queries/notifications";
import { cn } from "@/lib/utils";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

function safeHref(actionUrl: string): string {
  return actionUrl.startsWith("/") && !actionUrl.startsWith("//") && !actionUrl.startsWith("/\\")
    ? actionUrl
    : "/dashboard";
}

function formatCreatedAt(value: string): string {
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

export function NotificationList({ initialItems }: { initialItems: Notification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState(false);
  const unreadCount = items.filter((item) => !item.read_at).length;

  async function openNotification(
    event: React.MouseEvent<HTMLAnchorElement>,
    item: Notification,
  ) {
    if (item.read_at) return;
    event.preventDefault();
    try {
      await markNotificationReadAction(item.id);
    } catch {
      setError(true);
    }
    setItems((current) => current.map((entry) =>
      entry.id === item.id ? { ...entry, read_at: entry.read_at ?? new Date().toISOString() } : entry,
    ));
    router.push(safeHref(item.action_url));
  }

  async function markAllRead() {
    try {
      await markAllNotificationsReadAction();
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
      setError(false);
    } catch {
      setError(true);
    }
  }

  if (items.length === 0) {
    return (
      <Empty className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-12">
        <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
          <RiNotification3Line className="size-5" aria-hidden="true" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No notifications yet</EmptyTitle>
          <EmptyDescription>
            Updates about your orders and messages will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <section aria-label="Your notifications" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{items.length} recent</span>
          {unreadCount > 0 && <Badge variant="secondary">{unreadCount} unread</Badge>}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void markAllRead()}>
            <RiCheckDoubleLine className="mr-1 size-4" aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </div>
      {error && (
        <p role="status" className="border-b border-border/70 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 sm:px-5">
          We couldn&apos;t update a notification. You can try again.
        </p>
      )}
      <div>
        {items.map((item, index) => (
          <div key={item.id}>
            <Link
              href={safeHref(item.action_url)}
              onClick={(event) => void openNotification(event, item)}
              className={cn(
                "flex gap-3 px-4 py-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:px-5",
                !item.read_at && "bg-primary/5",
              )}
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read_at ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{item.title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{item.body}</span>
                <time className="mt-2 block text-xs text-muted-foreground" dateTime={item.created_at}>
                  {formatCreatedAt(item.created_at)}
                </time>
              </span>
            </Link>
            {index < items.length - 1 && <Separator />}
          </div>
        ))}
      </div>
    </section>
  );
}
