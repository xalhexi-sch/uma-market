"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { RiNotification3Line, RiCheckDoubleLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabase } from "@/hooks/use-supabase";
import type { Notification } from "@/lib/supabase/queries/notifications";
import { cn } from "@/lib/utils";

const LIMIT = 30;

/**
 * action_url is server-generated (INSERT is revoked for clients and the
 * read-only UPDATE trigger locks the column), but navigation is still
 * constrained to same-origin paths as defense in depth — legacy V2
 * notification URLs are relative and pass through unchanged.
 */
function safeHref(actionUrl: string): string {
  return actionUrl.startsWith("/") && !actionUrl.startsWith("//") && !actionUrl.startsWith("/\\")
    ? actionUrl
    : "/dashboard";
}

export function NotificationCenter() {
  const { userId, getToken } = useAuth();
  const supabase = useSupabase();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const unread = items.filter((item) => !item.read_at).length;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const { data, error: fetchError } = await supabase
      .from("notifications")
      .select("id, recipient_clerk_id, type, title, body, entity_type, entity_id, action_url, dedupe_key, read_at, created_at")
      .eq("recipient_clerk_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (fetchError) setError(true);
    else setItems((data ?? []) as Notification[]);
    setLoading(false);
  }, [supabase, userId]);

  // The async fetch updates state from its external response rather than during
  // the effect's synchronous execution.
  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchNotifications(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!userId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const connect = async () => {
      const token = await getToken({ skipCache: true });
      if (cancelled) return;
      if (token) await supabase.realtime.setAuth(token);
      channel = supabase.channel(`notifications:${userId}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "notifications",
          filter: `recipient_clerk_id=eq.${userId}`,
        }, (payload) => {
          const next = payload.new as Notification;
          setItems((current) => current.some((item) => item.id === next.id) ? current : [next, ...current].slice(0, LIMIT));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") return;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") void fetchNotifications();
        });
    };
    void connect();
    return () => { cancelled = true; if (channel) void supabase.removeChannel(channel); };
  }, [fetchNotifications, getToken, supabase, userId]);

  async function markRead(item: Notification) {
    if (item.read_at || !userId) return;
    const { error: updateError } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id).eq("recipient_clerk_id", userId).is("read_at", null);
    if (!updateError) setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry));
  }

  async function markAllRead() {
    if (!userId) return;
    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from("notifications").update({ read_at: now }).eq("recipient_clerk_id", userId).is("read_at", null);
    if (!updateError) setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} />}>
        <RiNotification3Line className="size-5" />
        {unread > 0 && <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">{unread > 99 ? "99+" : unread}</Badge>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0">
        <PopoverHeader className="flex-row items-center justify-between px-4 py-3">
          <PopoverTitle>Notifications</PopoverTitle>
          {unread > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void markAllRead()}><RiCheckDoubleLine className="mr-1 size-3.5" />Mark all read</Button>}
        </PopoverHeader>
        <Separator />
        <ScrollArea className="h-[min(28rem,70vh)]">
          {loading ? <div className="space-y-3 p-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div> : error ? <Empty><EmptyHeader><EmptyMedia variant="icon"><RiNotification3Line /></EmptyMedia><EmptyTitle>Could not load notifications</EmptyTitle><EmptyDescription>Try opening this panel again.</EmptyDescription></EmptyHeader></Empty> : items.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><RiNotification3Line /></EmptyMedia><EmptyTitle>No notifications yet</EmptyTitle><EmptyDescription>Updates about your orders and messages will appear here.</EmptyDescription></EmptyHeader></Empty> : <div>{items.map((item, index) => <div key={item.id}><Link href={safeHref(item.action_url)} onClick={() => void markRead(item)} className={cn("block px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", !item.read_at && "bg-primary/5")}><div className="flex gap-3"><span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read_at ? "bg-transparent" : "bg-primary")} /><div className="min-w-0"><p className="text-sm font-medium">{item.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p><time className="mt-1 block text-[11px] text-muted-foreground" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div></div></Link>{index < items.length - 1 && <Separator />}</div>)}</div>}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
