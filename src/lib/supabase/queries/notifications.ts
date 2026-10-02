import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export type Notification = {
  id: string;
  recipient_clerk_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string | null;
  action_url: string;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
};

const NOTIFICATION_LIMIT = 30;

export async function getNotifications(limit = NOTIFICATION_LIMIT): Promise<Notification[]> {
  const { userId } = await auth();
  if (!userId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, recipient_clerk_id, type, title, body, entity_type, entity_id, action_url, dedupe_key, read_at, created_at")
    .eq("recipient_clerk_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw error;
  return data ?? [];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { userId } = await auth();
  if (!userId) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_clerk_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_clerk_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_clerk_id", userId)
    .is("read_at", null);
  if (error) throw error;
}
