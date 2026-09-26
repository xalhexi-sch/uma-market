import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

function mapOrderRow(row: {
  id: string;
  business_clerk_id: string;
  farmer_clerk_id: string;
  status: string;
  fulfillment_type: string;
  total_amount: number | null;
  notes: string | null;
  delivery_address: string | null;
  pickup_date: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  business?: {
    clerk_id: string;
    full_name: string | null;
    business_name: string | null;
    city: string;
    phone?: string | null;
    address?: string | null;
  } | null;
  farmer?: {
    clerk_id: string;
    full_name: string | null;
    business_name: string | null;
    city: string;
    phone?: string | null;
  } | null;
  items?: Array<{
    id: string;
    order_id?: string;
    product_id: string;
    product_name: string | null;
    unit: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number | null;
    created_at: string;
  }> | null;
}): Order {
  return {
    id: row.id,
    business_clerk_id: row.business_clerk_id,
    farmer_clerk_id: row.farmer_clerk_id,
    status: row.status as Order["status"],
    fulfillment_type: row.fulfillment_type as Order["fulfillment_type"],
    total_amount: row.total_amount ? Number(row.total_amount) : null,
    notes: row.notes,
    delivery_address: row.delivery_address,
    pickup_date: row.pickup_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    accepted_at: row.accepted_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    cancellation_reason: row.cancellation_reason,
    business: row.business
      ? {
          clerk_id: row.business.clerk_id,
          full_name: row.business.full_name,
          business_name: row.business.business_name,
          city: row.business.city,
          phone: row.business.phone ?? null,
          address: row.business.address ?? null,
        }
      : undefined,
    farmer: row.farmer
      ? {
          clerk_id: row.farmer.clerk_id,
          full_name: row.farmer.full_name,
          business_name: row.farmer.business_name,
          city: row.farmer.city,
          phone: row.farmer.phone ?? null,
        }
      : undefined,
    items: row.items
      ? row.items.map((i) => ({
          id: i.id,
          order_id: i.order_id ?? row.id,
          product_id: i.product_id,
          product_name: i.product_name,
          unit: i.unit,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          subtotal: Number(i.subtotal ?? Number(i.quantity) * Number(i.unit_price)),
          created_at: i.created_at,
        }))
      : undefined,
  };
}

/**
 * Fetch all orders for a business buyer, newest first.
 */
export async function getBusinessOrders(
  businessClerkId: string,
  limit?: number
): Promise<Order[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      `
      id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      farmer:profiles!orders_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, phone),
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .eq("business_clerk_id", businessClerkId)
    .order("created_at", { ascending: false });

  if (limit !== undefined && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map(mapOrderRow);
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
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city, phone, address),
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .eq("id", orderId)
    .eq("business_clerk_id", businessClerkId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapOrderRow(data);
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
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city, phone, address),
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .in("id", orderIds)
    .eq("business_clerk_id", businessClerkId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapOrderRow);
}

/**
 * Fetch all orders directed to a farmer, newest first.
 */
export async function getFarmerOrders(
  farmerClerkId: string,
  limit?: number
): Promise<Order[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      `
      id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city, phone, address),
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .eq("farmer_clerk_id", farmerClerkId)
    .order("created_at", { ascending: false });

  if (limit !== undefined && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map(mapOrderRow);
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
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .eq("id", orderId)
    .eq("farmer_clerk_id", farmerClerkId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapOrderRow(data);
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
