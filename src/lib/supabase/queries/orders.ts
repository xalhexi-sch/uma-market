import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

/**
 * Fetch all orders for a business buyer, newest first.
 */
export async function getBusinessOrders(businessClerkId: string): Promise<Order[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      farmer:profiles!orders_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city),
      items:order_items(id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .eq("business_clerk_id", businessClerkId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Order[];
}

/**
 * Fetch a single order for a business buyer.
 */
export async function getBusinessOrderById(
  orderId: string,
  businessClerkId: string
): Promise<Order | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      farmer:profiles!orders_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, phone),
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city),
      items:order_items(id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .eq("id", orderId)
    .eq("business_clerk_id", businessClerkId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Order | null;
}

/**
 * Fetch multiple orders by their IDs for a business buyer.
 */
export async function getBusinessOrdersByIds(
  orderIds: string[],
  businessClerkId: string
): Promise<Order[]> {
  if (!orderIds || orderIds.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      farmer:profiles!orders_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, phone),
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city),
      items:order_items(id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .in("id", orderIds)
    .eq("business_clerk_id", businessClerkId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Order[];
}

/**
 * Fetch all orders directed to a farmer, newest first.
 */
export async function getFarmerOrders(farmerClerkId: string): Promise<Order[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city, phone),
      items:order_items(id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .eq("farmer_clerk_id", farmerClerkId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Order[];
}

/**
 * Fetch a single order directed to a farmer.
 */
export async function getFarmerOrderById(
  orderId: string,
  farmerClerkId: string
): Promise<Order | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city, phone, address),
      items:order_items(id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .eq("id", orderId)
    .eq("farmer_clerk_id", farmerClerkId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Order | null;
}

/**
 * Fetch recent order counts for dashboard metrics.
 */
export async function getBusinessOrderMetrics(businessClerkId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("status, total_amount")
    .eq("business_clerk_id", businessClerkId);

  if (error) return { active: 0, pendingDelivery: 0, total: 0, totalSpend: 0 };

  const orders = data ?? [];
  const nonCancelledOrders = orders.filter((o) => o.status !== "cancelled");
  const totalSpend = nonCancelledOrders.reduce(
    (sum, o) => sum + (Number(o.total_amount) || 0),
    0
  );

  return {
    active: orders.filter((o) =>
      ["pending", "accepted", "preparing", "ready"].includes(o.status)
    ).length,
    pendingDelivery: orders.filter((o) => o.status === "for_delivery").length,
    total: orders.length,
    totalSpend,
  };
}

/**
 * Fetch recent order counts for farmer dashboard.
 */
export async function getFarmerOrderMetrics(farmerClerkId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("status, total_amount")
    .eq("farmer_clerk_id", farmerClerkId);

  if (error) {
    return {
      pending: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      revenue: 0,
      fulfillmentRate: 100,
    };
  }

  const orders = data ?? [];
  const completedOrders = orders.filter((o) => o.status === "completed");
  const cancelledOrders = orders.filter((o) => o.status === "cancelled");
  const revenue = completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const resolvedCount = completedOrders.length + cancelledOrders.length;
  const fulfillmentRate = resolvedCount > 0 ? Math.round((completedOrders.length / resolvedCount) * 100) : 100;

  return {
    pending: orders.filter((o) => o.status === "pending").length,
    active: orders.filter((o) =>
      ["accepted", "preparing", "ready", "for_delivery"].includes(o.status)
    ).length,
    completed: completedOrders.length,
    cancelled: cancelledOrders.length,
    revenue,
    fulfillmentRate,
  };
}

/**
 * Fetch pending orders count for a farmer (drives sidebar operational badge).
 */
export async function getFarmerPendingOrderCount(farmerClerkId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("farmer_clerk_id", farmerClerkId)
    .eq("status", "pending");

  if (error) {
    console.error("[orders] getFarmerPendingOrderCount error:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Fetch active orders in 'ready' or 'for_delivery' for a commercial buyer (drives sidebar operational badge).
 */
export async function getBusinessActiveOrderCount(businessClerkId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("business_clerk_id", businessClerkId)
    .in("status", ["ready", "for_delivery"]);

  if (error) {
    console.error("[orders] getBusinessActiveOrderCount error:", error.message);
    return 0;
  }
  return count ?? 0;
}
