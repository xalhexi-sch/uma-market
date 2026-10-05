"use server";

import { revalidatePath } from "next/cache";
import { requireActiveBusiness } from "@/platform/business-context";
import { createClient } from "@/lib/supabase/server";
import { messageRateLimit } from "@/lib/rate-limit";
import { SendV4MessageSchema } from "@/lib/validation";
import { getOrCreateRelationshipConversation } from "@/lib/supabase/queries/conversations";

/**
 * Helper to resolve a business ID from legacy clerk_id
 */
async function getBusinessIdByClerkId(clerkId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: legacy } = await supabase
    .from("businesses")
    .select("id")
    .eq("legacy_clerk_id", clerkId)
    .maybeSingle();
  if (legacy?.id) return legacy.id;

  const { data: member } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", clerkId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return member?.business_id ?? null;
}

/**
 * Send a message within a V4 unified conversation.
 * Enforces active business membership, server-side participant authorization,
 * and context verification (product/order ownership).
 */
export async function sendV4Message(payload: {
  conversationId: string;
  body: string;
  productId?: string | null;
  orderId?: string | null;
}) {
  const parsed = SendV4MessageSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid message parameters." };
  }

  const { conversationId, body: cleanBody, productId, orderId } = parsed.data;

  // 1. Resolve active authenticated business context
  let context;
  try {
    context = await requireActiveBusiness();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Authentication or active business required.",
    };
  }

  const { user, business } = context;

  // 2. Rate limit: 50 messages per minute per user
  const rateResult = messageRateLimit(user.userId);
  if (!rateResult.success) {
    return { success: false, error: "Too many messages. Please slow down." };
  }

  const supabase = await createClient();

  // 3. Verify conversation exists and active business is a participant
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id, business_a_id, business_b_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convErr || !conv) {
    return { success: false, error: "Conversation not found." };
  }

  if (conv.business_a_id !== business.id && conv.business_b_id !== business.id) {
    return { success: false, error: "You are not authorized to participate in this conversation." };
  }

  // 4. Validate product context if provided: must belong to one of the conversation participants
  if (productId) {
    const { data: product } = await supabase
      .from("products")
      .select("id, business_id, farmer_clerk_id")
      .eq("id", productId)
      .maybeSingle();

    if (!product) {
      return { success: false, error: "Referenced product context was not found." };
    }

    let prodBizId = product.business_id;
    if (!prodBizId) {
      prodBizId = await getBusinessIdByClerkId(product.farmer_clerk_id);
    }

    if (!prodBizId || (prodBizId !== conv.business_a_id && prodBizId !== conv.business_b_id)) {
      return { success: false, error: "Product does not belong to the producer in this conversation." };
    }
  }

  // 5. Validate order context if provided: must belong to the two businesses in this conversation
  if (orderId) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, business_id, business_clerk_id, farmer_clerk_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return { success: false, error: "Referenced order context was not found." };
    }

    const orderBuyerBizId = order.business_id ?? (await getBusinessIdByClerkId(order.business_clerk_id));
    const orderSellerBizId = await getBusinessIdByClerkId(order.farmer_clerk_id);

    const isMatch =
      (orderBuyerBizId === conv.business_a_id && orderSellerBizId === conv.business_b_id) ||
      (orderBuyerBizId === conv.business_b_id && orderSellerBizId === conv.business_a_id);

    if (!isMatch) {
      return { success: false, error: "Order does not belong to the businesses in this conversation." };
    }
  }

  // 6. Insert message
  const { data: message, error: insertErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_clerk_id: user.userId,
      sender_business_id: business.id,
      body: cleanBody,
      product_id: productId ?? null,
      order_id: orderId ?? null,
    })
    .select("id, conversation_id, sender_clerk_id, sender_business_id, body, created_at, product_id, order_id")
    .single();

  if (insertErr || !message) {
    console.error("[messages] sendV4Message error:", insertErr?.message);
    return { success: false, error: "Could not send message. Please try again." };
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);

  return { success: true, message };
}

/**
 * Server-derives the relationship conversation between the active business
 * and a product's producer.
 */
export async function resolveProductConversation(productId: string): Promise<
  { success: true; conversationId: string } | { success: false; error: string }
> {
  let context;
  try {
    context = await requireActiveBusiness();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Authentication or active business required.",
    };
  }

  const { business: callerBusiness } = context;

  const supabase = await createClient();

  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, name, business_id, farmer_clerk_id")
    .eq("id", productId)
    .maybeSingle();

  if (prodErr || !product) {
    return { success: false, error: "Product not found." };
  }

  let sellerBusinessId = product.business_id;
  if (!sellerBusinessId) {
    sellerBusinessId = await getBusinessIdByClerkId(product.farmer_clerk_id);
  }

  if (!sellerBusinessId) {
    return { success: false, error: "Could not resolve producer business profile." };
  }

  if (sellerBusinessId === callerBusiness.id) {
    return { success: false, error: "You cannot initiate a message with your own business." };
  }

  try {
    const conversationId = await getOrCreateRelationshipConversation(callerBusiness.id, sellerBusinessId);
    return { success: true, conversationId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not create conversation.",
    };
  }
}

/**
 * Server-derives the relationship conversation between an order's buyer and seller.
 * Verifies that the active business is either the buyer or the seller.
 */
export async function resolveOrderConversation(orderId: string): Promise<
  { success: true; conversationId: string } | { success: false; error: string }
> {
  let context;
  try {
    context = await requireActiveBusiness();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Authentication or active business required.",
    };
  }

  const { business: callerBusiness } = context;

  const supabase = await createClient();

  const { data: order, error: ordErr } = await supabase
    .from("orders")
    .select("id, business_id, business_clerk_id, farmer_clerk_id")
    .eq("id", orderId)
    .maybeSingle();

  if (ordErr || !order) {
    return { success: false, error: "Order not found." };
  }

  const buyerBusinessId = order.business_id ?? (await getBusinessIdByClerkId(order.business_clerk_id));
  const sellerBusinessId = await getBusinessIdByClerkId(order.farmer_clerk_id);

  if (!buyerBusinessId || !sellerBusinessId) {
    return { success: false, error: "Could not resolve order participant businesses." };
  }

  if (callerBusiness.id !== buyerBusinessId && callerBusiness.id !== sellerBusinessId) {
    return { success: false, error: "You are not authorized to view messages for this order." };
  }

  try {
    const conversationId = await getOrCreateRelationshipConversation(buyerBusinessId, sellerBusinessId);
    return { success: true, conversationId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not resolve order conversation.",
    };
  }
}

/**
 * Server-derives the relationship conversation between the active business
 * and a producer's business (from producer clerk_id).
 */
export async function resolveProducerConversation(producerClerkId: string): Promise<
  { success: true; conversationId: string } | { success: false; error: string }
> {
  let context;
  try {
    context = await requireActiveBusiness();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Authentication or active business required.",
    };
  }

  const { business: callerBusiness } = context;

  const sellerBusinessId = await getBusinessIdByClerkId(producerClerkId);
  if (!sellerBusinessId) {
    return { success: false, error: "Could not resolve producer business." };
  }

  if (sellerBusinessId === callerBusiness.id) {
    return { success: false, error: "You cannot initiate a message with your own business." };
  }

  try {
    const conversationId = await getOrCreateRelationshipConversation(callerBusiness.id, sellerBusinessId);
    return { success: true, conversationId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not establish conversation with producer.",
    };
  }
}

