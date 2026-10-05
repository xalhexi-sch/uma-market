import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

export type OrderViewTab = "needs" | "progress" | "completed" | "cancelled";

export const ORDER_TAB_STATUSES: Record<OrderViewTab, string[]> = {
  needs: ["pending"],
  progress: ["accepted", "preparing", "ready", "for_delivery"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

export interface OrderQueryOptions {
  statusGroup?: OrderViewTab;
  statuses?: string[];
  sortDirection?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface OrderTabCounts {
  needs: number;
  progress: number;
  completed: number;
  cancelled: number;
  total: number;
}

function mapOrderRow(row: {
  id: string;
  business_id?: string | null;
  placed_by_user_id?: string | null;
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
    business_id: row.business_id ?? null,
    placed_by_user_id: row.placed_by_user_id ?? null,
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
 * Fetch all orders for a business buyer, with optional tab status filtering,
 * database-level sorting, and pagination.
 */
export async function getBusinessOrders(
  businessClerkId: string,
  optionsOrLimit?: OrderQueryOptions | number
): Promise<Order[]> {
  const options: OrderQueryOptions =
    typeof optionsOrLimit === "number"
      ? { limit: optionsOrLimit }
      : optionsOrLimit ?? {};

  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      `
      id, business_id, placed_by_user_id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      farmer:profiles!orders_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, phone),
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .eq("business_clerk_id", businessClerkId);

  // Status filtering: push filter to database
  if (options.statusGroup) {
    const statuses = ORDER_TAB_STATUSES[options.statusGroup];
    if (statuses && statuses.length === 1) {
      query = query.eq("status", statuses[0]);
    } else if (statuses && statuses.length > 1) {
      query = query.in("status", statuses);
    }
  } else if (options.statuses && options.statuses.length > 0) {
    if (options.statuses.length === 1) {
      query = query.eq("status", options.statuses[0]);
    } else {
      query = query.in("status", options.statuses);
    }
  }

  // Ordering: needs/progress oldest-first (longest waiting); completed/cancelled newest-first
  const ascending =
    options.sortDirection !== undefined
      ? options.sortDirection === "asc"
      : options.statusGroup === "needs" || options.statusGroup === "progress";

  query = query.order("created_at", { ascending });

  // Pagination / Limit — always bounded (default 50)
  const effectiveLimit = options.limit && options.limit > 0 ? options.limit : 50;
  if (options.offset !== undefined && options.offset > 0) {
    query = query.range(options.offset, options.offset + effectiveLimit - 1);
  } else {
    query = query.limit(effectiveLimit);
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
      id, business_id, placed_by_user_id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
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
      id, business_id, placed_by_user_id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
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
 * Fetch all orders for a V4 buyer business, with optional tab status filtering,
 * database-level sorting, and pagination.
 *
 * Scoped strictly to the active business_id (with optional legacy_clerk_id fallback).
 */
export async function getV4BuyerOrders(
  businessId: string,
  optionsOrLimit?: OrderQueryOptions | number,
  legacyClerkId?: string | null
): Promise<Order[]> {
  const options: OrderQueryOptions =
    typeof optionsOrLimit === "number"
      ? { limit: optionsOrLimit }
      : optionsOrLimit ?? {};

  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      `
      id, business_id, placed_by_user_id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      farmer:profiles!orders_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, phone),
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city, phone, address),
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    );

  if (legacyClerkId) {
    query = query.or(`business_id.eq.${businessId},business_clerk_id.eq.${legacyClerkId}`);
  } else {
    query = query.eq("business_id", businessId);
  }

  // Status filtering: push filter to database
  if (options.statusGroup) {
    const statuses = ORDER_TAB_STATUSES[options.statusGroup];
    if (statuses && statuses.length === 1) {
      query = query.eq("status", statuses[0]);
    } else if (statuses && statuses.length > 1) {
      query = query.in("status", statuses);
    }
  } else if (options.statuses && options.statuses.length > 0) {
    if (options.statuses.length === 1) {
      query = query.eq("status", options.statuses[0]);
    } else {
      query = query.in("status", options.statuses);
    }
  }

  // Ordering: needs/progress oldest-first (longest waiting); completed/cancelled newest-first
  const ascending =
    options.sortDirection !== undefined
      ? options.sortDirection === "asc"
      : options.statusGroup === "needs" || options.statusGroup === "progress";

  query = query.order("created_at", { ascending });

  // Pagination / Limit — always bounded (default 50)
  const effectiveLimit = options.limit && options.limit > 0 ? options.limit : 50;
  if (options.offset !== undefined && options.offset > 0) {
    query = query.range(options.offset, options.offset + effectiveLimit - 1);
  } else {
    query = query.limit(effectiveLimit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map(mapOrderRow);
}

/**
 * Fetch a single order for a V4 buyer business.
 * Scoped strictly to the active business_id (with optional legacy_clerk_id fallback).
 */
export async function getV4BuyerOrderById(
  orderId: string,
  businessId: string,
  legacyClerkId?: string | null
): Promise<Order | null> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      `
      id, business_id, placed_by_user_id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      farmer:profiles!orders_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, phone),
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city, phone, address),
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    )
    .eq("id", orderId);

  if (legacyClerkId) {
    query = query.or(`business_id.eq.${businessId},business_clerk_id.eq.${legacyClerkId}`);
  } else {
    query = query.eq("business_id", businessId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapOrderRow(data);
}

/**
 * Fetch lightweight status counts across all order tabs for a V4 buyer business.
 */
export async function getV4BuyerOrderTabCounts(
  businessId: string,
  legacyClerkId?: string | null
): Promise<OrderTabCounts> {
  const supabase = await createClient();
  let query = supabase.from("orders").select("status");

  if (legacyClerkId) {
    query = query.or(`business_id.eq.${businessId},business_clerk_id.eq.${legacyClerkId}`);
  } else {
    query = query.eq("business_id", businessId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[orders] getV4BuyerOrderTabCounts error:", error.message);
    return computeTabCounts(null);
  }
  return computeTabCounts(data);
}

/**
 * Fetch member profile for order audit trail (placed_by_user_id).
 */
export async function getOrderPlacerProfile(
  clerkUserId: string
): Promise<{ full_name: string | null; business_name: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, business_name")
    .eq("clerk_id", clerkUserId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Fetch all incoming wholesale orders directed to a V4 seller/producer business,
 * with optional tab status filtering, database-level sorting, and pagination.
 *
 * Scoped strictly to the seller Clerk IDs belonging to the active business.
 */
export async function getV4SellerOrders(
  sellerClerkIds: string | string[],
  optionsOrLimit?: OrderQueryOptions | number
): Promise<Order[]> {
  const options: OrderQueryOptions =
    typeof optionsOrLimit === "number"
      ? { limit: optionsOrLimit }
      : optionsOrLimit ?? {};

  const supabase = await createClient();

  const ids = Array.isArray(sellerClerkIds)
    ? sellerClerkIds.filter(Boolean)
    : [sellerClerkIds].filter(Boolean);

  if (ids.length === 0) return [];

  let query = supabase
    .from("orders")
    .select(
      `
      id, business_id, placed_by_user_id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city, phone, address),
      farmer:profiles!orders_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, phone),
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `
    );

  if (ids.length === 1) {
    query = query.eq("farmer_clerk_id", ids[0]);
  } else {
    query = query.in("farmer_clerk_id", ids);
  }

  // Status filtering: push filter to database
  if (options.statusGroup) {
    const statuses = ORDER_TAB_STATUSES[options.statusGroup];
    if (statuses && statuses.length === 1) {
      query = query.eq("status", statuses[0]);
    } else if (statuses && statuses.length > 1) {
      query = query.in("status", statuses);
    }
  } else if (options.statuses && options.statuses.length > 0) {
    if (options.statuses.length === 1) {
      query = query.eq("status", options.statuses[0]);
    } else {
      query = query.in("status", options.statuses);
    }
  }

  // Ordering: needs/progress oldest-first (longest waiting); completed/cancelled newest-first
  const ascending =
    options.sortDirection !== undefined
      ? options.sortDirection === "asc"
      : options.statusGroup === "needs" || options.statusGroup === "progress";

  query = query.order("created_at", { ascending });

  // Pagination / Limit — always bounded (default 50)
  const effectiveLimit = options.limit && options.limit > 0 ? options.limit : 50;
  if (options.offset !== undefined && options.offset > 0) {
    query = query.range(options.offset, options.offset + effectiveLimit - 1);
  } else {
    query = query.limit(effectiveLimit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapOrderRow);
}

/**
 * Fetch lightweight status counts across all order tabs for a V4 seller business.
 */
export async function getV4SellerOrderTabCounts(
  sellerClerkIds: string | string[]
): Promise<OrderTabCounts> {
  const supabase = await createClient();
  const ids = Array.isArray(sellerClerkIds)
    ? sellerClerkIds.filter(Boolean)
    : [sellerClerkIds].filter(Boolean);

  if (ids.length === 0) return computeTabCounts(null);

  let query = supabase.from("orders").select("status");
  if (ids.length === 1) {
    query = query.eq("farmer_clerk_id", ids[0]);
  } else {
    query = query.in("farmer_clerk_id", ids);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[orders] getV4SellerOrderTabCounts error:", error.message);
    return computeTabCounts(null);
  }
  return computeTabCounts(data);
}

/**
 * Fetch all orders directed to a farmer, with optional tab status filtering,
 * database-level sorting, and pagination.
 */
export async function getFarmerOrders(
  farmerClerkId: string,
  optionsOrLimit?: OrderQueryOptions | number
): Promise<Order[]> {
  const options: OrderQueryOptions =
    typeof optionsOrLimit === "number"
      ? { limit: optionsOrLimit }
      : optionsOrLimit ?? {};

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
    .eq("farmer_clerk_id", farmerClerkId);

  // Status filtering: push filter to database
  if (options.statusGroup) {
    const statuses = ORDER_TAB_STATUSES[options.statusGroup];
    if (statuses && statuses.length === 1) {
      query = query.eq("status", statuses[0]);
    } else if (statuses && statuses.length > 1) {
      query = query.in("status", statuses);
    }
  } else if (options.statuses && options.statuses.length > 0) {
    if (options.statuses.length === 1) {
      query = query.eq("status", options.statuses[0]);
    } else {
      query = query.in("status", options.statuses);
    }
  }

  // Ordering: needs/progress oldest-first (longest waiting); completed/cancelled newest-first
  const ascending =
    options.sortDirection !== undefined
      ? options.sortDirection === "asc"
      : options.statusGroup === "needs" || options.statusGroup === "progress";

  query = query.order("created_at", { ascending });

  // Pagination / Limit — always bounded (default 50)
  const effectiveLimit = options.limit && options.limit > 0 ? options.limit : 50;
  if (options.offset !== undefined && options.offset > 0) {
    query = query.range(options.offset, options.offset + effectiveLimit - 1);
  } else {
    query = query.limit(effectiveLimit);
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

function computeTabCounts(rows: Array<{ status: string }> | null): OrderTabCounts {
  const counts: OrderTabCounts = {
    needs: 0,
    progress: 0,
    completed: 0,
    cancelled: 0,
    total: rows?.length ?? 0,
  };

  if (!rows) return counts;

  for (const row of rows) {
    if (row.status === "pending") {
      counts.needs++;
    } else if (["accepted", "preparing", "ready", "for_delivery"].includes(row.status)) {
      counts.progress++;
    } else if (row.status === "completed") {
      counts.completed++;
    } else if (row.status === "cancelled") {
      counts.cancelled++;
    }
  }

  return counts;
}

/**
 * Fetch lightweight status counts across all order tabs for a commercial buyer.
 * Uses index scan on (business_clerk_id) with no joins or heavy payload.
 */
export async function getBusinessOrderTabCounts(businessClerkId: string): Promise<OrderTabCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .eq("business_clerk_id", businessClerkId);

  if (error) {
    console.error("[orders] getBusinessOrderTabCounts error:", error.message);
    return computeTabCounts(null);
  }
  return computeTabCounts(data);
}

/**
 * Fetch lightweight status counts across all order tabs for a farmer.
 * Uses index scan on (farmer_clerk_id) with no joins or heavy payload.
 */
export async function getFarmerOrderTabCounts(farmerClerkId: string): Promise<OrderTabCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .eq("farmer_clerk_id", farmerClerkId);

  if (error) {
    console.error("[orders] getFarmerOrderTabCounts error:", error.message);
    return computeTabCounts(null);
  }
  return computeTabCounts(data);
}
