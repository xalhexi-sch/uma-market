import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";

export interface ConversationParticipant {
  id: string;
  name: string;
  canBuy: boolean;
  canSell: boolean;
}

export interface DetailedV4Conversation {
  id: string;
  businessAId: string;
  businessBId: string;
  counterparty: ConversationParticipant;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: {
    id: string;
    body: string;
    createdAt: string;
    senderClerkId: string;
    senderBusinessId?: string | null;
    productId?: string | null;
    orderId?: string | null;
  };
}

/**
 * Fetch all conversations for a specific business.
 * RLS enforces that caller's active business is either business_a_id or business_b_id.
 */
export async function getV4BusinessConversations(
  businessId: string
): Promise<DetailedV4Conversation[]> {
  const supabase = await createClient();

  const { data: convs, error } = await supabase
    .from("conversations")
    .select(`
      id,
      business_a_id,
      business_b_id,
      last_message_at,
      created_at,
      updated_at
    `)
    .or(`business_a_id.eq.${businessId},business_b_id.eq.${businessId}`)
    .order("last_message_at", { ascending: false });

  if (error || !convs || convs.length === 0) {
    return [];
  }

  // Collect all counterparty business IDs
  const counterpartyIds = Array.from(
    new Set(
      convs.map((c) => (c.business_a_id === businessId ? c.business_b_id : c.business_a_id))
    )
  );

  // Fetch business details for all counterparties
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, can_buy, can_sell")
    .in("id", counterpartyIds);

  const businessMap = new Map<string, ConversationParticipant>();
  businesses?.forEach((b) => {
    businessMap.set(b.id, {
      id: b.id,
      name: b.name,
      canBuy: b.can_buy,
      canSell: b.can_sell,
    });
  });

  // Fetch the latest message for each conversation
  const convIds = convs.map((c) => c.id);
  const { data: messages } = await supabase
    .from("messages")
    .select("id, conversation_id, body, created_at, sender_clerk_id, sender_business_id, product_id, order_id")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });

  // Map latest message by conversation_id
  const latestMessageMap = new Map<string, NonNullable<typeof messages>[number]>();
  messages?.forEach((m) => {
    if (m.conversation_id && !latestMessageMap.has(m.conversation_id)) {
      latestMessageMap.set(m.conversation_id, m);
    }
  });

  return convs.map((c) => {
    const counterpartyId = c.business_a_id === businessId ? c.business_b_id : c.business_a_id;
    const counterparty = businessMap.get(counterpartyId) ?? {
      id: counterpartyId,
      name: "Partner Business",
      canBuy: false,
      canSell: false,
    };
    const lastMsg = latestMessageMap.get(c.id);

    return {
      id: c.id,
      businessAId: c.business_a_id,
      businessBId: c.business_b_id,
      counterparty,
      lastMessageAt: c.last_message_at,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            body: lastMsg.body,
            createdAt: lastMsg.created_at,
            senderClerkId: lastMsg.sender_clerk_id,
            senderBusinessId: lastMsg.sender_business_id,
            productId: lastMsg.product_id,
            orderId: lastMsg.order_id,
          }
        : undefined,
    };
  });
}

/**
 * Fetch a single conversation by ID and verify the active business participates.
 */
export async function getV4Conversation(
  conversationId: string,
  activeBusinessId: string
): Promise<DetailedV4Conversation | null> {
  const supabase = await createClient();

  const { data: conv, error } = await supabase
    .from("conversations")
    .select(`
      id,
      business_a_id,
      business_b_id,
      last_message_at,
      created_at,
      updated_at
    `)
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !conv) {
    return null;
  }

  // Authorization check: active business must be participant A or B
  if (conv.business_a_id !== activeBusinessId && conv.business_b_id !== activeBusinessId) {
    return null;
  }

  const counterpartyId =
    conv.business_a_id === activeBusinessId ? conv.business_b_id : conv.business_a_id;

  const { data: counterpartyBiz } = await supabase
    .from("businesses")
    .select("id, name, can_buy, can_sell")
    .eq("id", counterpartyId)
    .maybeSingle();

  return {
    id: conv.id,
    businessAId: conv.business_a_id,
    businessBId: conv.business_b_id,
    counterparty: {
      id: counterpartyId,
      name: counterpartyBiz?.name ?? "Partner Business",
      canBuy: counterpartyBiz?.can_buy ?? false,
      canSell: counterpartyBiz?.can_sell ?? false,
    },
    lastMessageAt: conv.last_message_at,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
  };
}

/**
 * Fetch all messages for a specific conversation with joined sender, product, and order context.
 */
export async function getV4ConversationMessages(
  conversationId: string
): Promise<Message[]> {
  const supabase = await createClient();

  const { data: messages, error } = await supabase
    .from("messages")
    .select(`
      id,
      conversation_id,
      order_id,
      product_id,
      sender_clerk_id,
      sender_business_id,
      body,
      created_at,
      sender:profiles!messages_sender_clerk_id_fkey(clerk_id, full_name, avatar_url)
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error || !messages) {
    console.error("[conversations] getV4ConversationMessages error:", error?.message);
    return [];
  }

  // Enrich with product and order contexts if attached
  const productIds = Array.from(
    new Set(messages.map((m) => m.product_id).filter((id): id is string => Boolean(id)))
  );
  const orderIds = Array.from(
    new Set(messages.map((m) => m.order_id).filter((id): id is string => Boolean(id)))
  );

  const productMap = new Map<string, { id: string; name: string; price_per_unit: number; unit: string; image_url?: string | null }>();
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, price_per_unit, unit, image_url")
      .in("id", productIds);

    products?.forEach((p) => {
      productMap.set(p.id, p);
    });
  }

  const orderMap = new Map<string, { id: string; status: string; total_amount: number }>();
  if (orderIds.length > 0) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, status, total_amount")
      .in("id", orderIds);

    orders?.forEach((o) => {
      orderMap.set(o.id, {
        id: o.id,
        status: o.status,
        total_amount: Number(o.total_amount),
      });
    });
  }

  return messages.map((m) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    order_id: m.order_id,
    product_id: m.product_id,
    sender_clerk_id: m.sender_clerk_id,
    sender_business_id: m.sender_business_id,
    body: m.body,
    created_at: m.created_at,
    sender: Array.isArray(m.sender) ? m.sender[0] : (m.sender ?? undefined),
    product: m.product_id ? productMap.get(m.product_id) ?? null : null,
    order: m.order_id ? orderMap.get(m.order_id) ?? null : null,
  }));
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get or create the unique canonical relationship conversation between two businesses.
 * Canonical ordering: business_a_id < business_b_id.
 */
export async function getOrCreateRelationshipConversation(
  business1Id: string,
  business2Id: string,
  client?: SupabaseClient
): Promise<string> {
  if (!business1Id || !business2Id) {
    throw new Error("Both business IDs are required to establish a conversation.");
  }
  if (business1Id === business2Id) {
    throw new Error("Cannot create a conversation with the same business.");
  }

  const businessAId = business1Id < business2Id ? business1Id : business2Id;
  const businessBId = business1Id < business2Id ? business2Id : business1Id;

  const supabase = client ?? (await createClient());

  // 1. Try to find existing
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("business_a_id", businessAId)
    .eq("business_b_id", businessBId)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  // 2. Insert with canonical ordering
  const { data: inserted, error: insertError } = await supabase
    .from("conversations")
    .insert({
      business_a_id: businessAId,
      business_b_id: businessBId,
    })
    .select("id")
    .maybeSingle();

  if (inserted) {
    return inserted.id;
  }

  // 3. In case of concurrent race condition, re-query existing
  if (insertError) {
    const { data: retry } = await supabase
      .from("conversations")
      .select("id")
      .eq("business_a_id", businessAId)
      .eq("business_b_id", businessBId)
      .maybeSingle();

    if (retry) {
      return retry.id;
    }
    throw new Error(`Failed to initialize relationship conversation: ${insertError.message}`);
  }

  throw new Error("Could not resolve conversation.");
}
