import { createClient } from "@/lib/supabase/server";
import type { Message, Profile } from "@/lib/types";

export interface Conversation {
  orderId: string;
  orderNumber: string;
  status: string;
  fulfillmentType: string;
  counterpartyId: string;
  counterpartyName: string;
  counterpartyBusiness: string | null;
  lastMessage?: {
    body: string;
    createdAt: string;
    senderId: string;
  };
  totalMessages: number;
}

/**
 * Fetch all messages for a specific order.
 * Verified by RLS: caller must be buyer or farmer on the order.
 */
export async function getOrderMessages(orderId: string): Promise<Message[]> {
  const supabase = await createClient();

  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, order_id, sender_clerk_id, body, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[messages] getOrderMessages error:", error.message);
    return [];
  }

  if (!messages || messages.length === 0) {
    return [];
  }

  // Fetch sender profile details for all unique senders
  const senderIds = Array.from(new Set(messages.map((m) => m.sender_clerk_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("clerk_id, full_name, avatar_url, business_name")
    .in("clerk_id", senderIds);

  const profileMap = new Map<string, Pick<Profile, "clerk_id" | "full_name" | "avatar_url" | "business_name">>();
  profiles?.forEach((p) => {
    profileMap.set(p.clerk_id, p);
  });

  return messages.map((m) => ({
    ...m,
    sender: profileMap.get(m.sender_clerk_id),
  }));
}

/**
 * Fetch all order-threaded conversations for a user.
 */
export async function getUserConversations(
  userId: string,
  role: "business" | "farmer"
): Promise<Conversation[]> {
  const supabase = await createClient();

  // 1. Fetch user's orders
  const filterCol = role === "business" ? "business_clerk_id" : "farmer_clerk_id";
  const counterpartyCol = role === "business" ? "farmer_clerk_id" : "business_clerk_id";

  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select(`
      id, status, fulfillment_type, created_at,
      ${counterpartyCol}
    `)
    .eq(filterCol, userId)
    .order("created_at", { ascending: false });

  if (ordersErr || !orders || orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((o) => o.id);

  // 2. Fetch all messages on these orders
  const { data: allMessages } = await supabase
    .from("messages")
    .select("id, order_id, sender_clerk_id, body, created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });

  // 3. Fetch counterparties profiles
  const counterpartyIds = Array.from(
    new Set(orders.map((o) => (o as Record<string, unknown>)[counterpartyCol] as string).filter(Boolean))
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("clerk_id, full_name, business_name")
    .in("clerk_id", counterpartyIds);

  const profileMap = new Map<string, { full_name: string | null; business_name: string | null }>();
  profiles?.forEach((p) => {
    profileMap.set(p.clerk_id, {
      full_name: p.full_name,
      business_name: p.business_name,
    });
  });

  // Group messages by orderId
  const messagesByOrder = new Map<string, typeof allMessages>();
  allMessages?.forEach((m) => {
    const list = messagesByOrder.get(m.order_id) ?? [];
    list.push(m);
    messagesByOrder.set(m.order_id, list);
  });

  return orders.map((order) => {
    const cId = (order as Record<string, unknown>)[counterpartyCol] as string;
    const cProfile = profileMap.get(cId);
    const msgs = messagesByOrder.get(order.id) ?? [];
    const last = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;

    return {
      orderId: order.id,
      orderNumber: `UMA-${order.id.slice(0, 8).toUpperCase()}`,
      status: order.status,
      fulfillmentType: order.fulfillment_type,
      counterpartyId: cId,
      counterpartyName: cProfile?.full_name ?? "Partner",
      counterpartyBusiness: cProfile?.business_name ?? null,
      lastMessage: last
        ? {
            body: last.body,
            createdAt: last.created_at,
            senderId: last.sender_clerk_id,
          }
        : undefined,
      totalMessages: msgs.length,
    };
  });
}
