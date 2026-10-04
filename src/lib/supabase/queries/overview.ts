import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/constants";
import type { Order } from "@/lib/types";

// ── Types ─────────────────────────────────────────

export interface OverviewKPI {
  totalOrders: number;
  totalSales: number;
  productsListed: number;
  activeCustomers: number;
}

export interface SalesDataPoint {
  date: string;
  sales: number;
  orders: number;
}

export interface OrderStatusBreakdown {
  status: string;
  label: string;
  count: number;
  color: string;
}

export interface TopProduct {
  id: string;
  name: string;
  category: string;
  unitsSold: number;
  unit: string;
  revenue: number;
}

export interface RecentOverviewOrder {
  id: string;
  buyerName: string;
  buyerCity: string;
  productName: string;
  productQuantity: string;
  amount: number;
  status: OrderStatus;
  date: string;
}

/**
 * Maps a bounded `Order` row (from getBusinessOrders/getFarmerOrders, which
 * join the counterparty profile and items) onto the overview table shape.
 * The dashboard home pages fetch at most 3 rows through those bounded
 * queries and render them with this mapper.
 */
export function toRecentOverviewOrder(order: Order): RecentOverviewOrder {
  const party = order.farmer ?? order.business;
  const firstItem = order.items?.[0];
  const totalItems = order.items?.length ?? 0;

  return {
    id: order.id,
    buyerName: party?.business_name || party?.full_name || "Unknown",
    buyerCity: party?.city || "",
    productName: firstItem?.product_name ?? "—",
    productQuantity: firstItem
      ? `${firstItem.quantity} ${firstItem.unit ?? ""}${totalItems > 1 ? ` +${totalItems - 1}` : ""}`
      : "—",
    amount: order.total_amount ?? 0,
    status: order.status,
    date: order.created_at,
  };
}

// ── Status colors ─────────────────────────────────

const STATUS_CHART_COLORS: Record<string, string> = {
  completed: "hsl(142, 71%, 45%)",
  pending: "hsl(38, 92%, 50%)",
  in_progress: "hsl(217, 91%, 60%)",
  cancelled: "hsl(0, 84%, 60%)",
};

const STATUS_CHART_LABELS: Record<string, string> = {
  completed: "Completed",
  pending: "Pending",
  in_progress: "In Progress",
  cancelled: "Cancelled",
};

// ── Farmer Overview KPIs ──────────────────────────

export async function getFarmerOverviewKPIs(
  farmerClerkId: string
): Promise<OverviewKPI> {
  const supabase = await createClient();

  // Get all orders for the farmer
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, status, total_amount, business_clerk_id")
    .eq("farmer_clerk_id", farmerClerkId);

  if (ordersError) {
    console.error("[overview] getFarmerOverviewKPIs orders error:", ordersError.message);
    return { totalOrders: 0, totalSales: 0, productsListed: 0, activeCustomers: 0 };
  }

  // Get active product count
  const { count: productsCount, error: productsError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("farmer_clerk_id", farmerClerkId)
    .eq("status", "active");

  if (productsError) {
    console.error("[overview] getFarmerOverviewKPIs products error:", productsError.message);
  }

  const allOrders = orders ?? [];
  const nonCancelledOrders = allOrders.filter((o) => o.status !== "cancelled");
  const totalSales = nonCancelledOrders.reduce(
    (sum, o) => sum + (Number(o.total_amount) || 0),
    0
  );

  // Unique customers (business buyers)
  const uniqueCustomers = new Set(allOrders.map((o) => o.business_clerk_id));

  return {
    totalOrders: allOrders.length,
    totalSales,
    productsListed: productsCount ?? 0,
    activeCustomers: uniqueCustomers.size,
  };
}

// ── Farmer Sales Over Time ────────────────────────

export async function getFarmerSalesOverTime(
  farmerClerkId: string,
  days: number = 7
): Promise<SalesDataPoint[]> {
  const supabase = await createClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startISO = startDate.toISOString();

  const { data, error } = await supabase
    .from("orders")
    .select("created_at, total_amount, status")
    .eq("farmer_clerk_id", farmerClerkId)
    .gte("created_at", startISO)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[overview] getFarmerSalesOverTime error:", error.message);
    return [];
  }

  // Group by date
  const grouped = new Map<string, { sales: number; orders: number }>();

  // Pre-populate all dates in range
  for (let i = 0; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    grouped.set(key, { sales: 0, orders: 0 });
  }

  for (const row of data ?? []) {
    const d = new Date(row.created_at);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const existing = grouped.get(key) ?? { sales: 0, orders: 0 };
    existing.sales += Number(row.total_amount) || 0;
    existing.orders += 1;
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries()).map(([date, data]) => ({
    date,
    sales: data.sales,
    orders: data.orders,
  }));
}

// ── Farmer Order Status Breakdown ─────────────────

export async function getFarmerOrderStatusBreakdown(
  farmerClerkId: string
): Promise<{ breakdown: OrderStatusBreakdown[]; total: number }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .eq("farmer_clerk_id", farmerClerkId);

  if (error) {
    console.error("[overview] getFarmerOrderStatusBreakdown error:", error.message);
    return { breakdown: [], total: 0 };
  }

  const orders = data ?? [];
  const counts = new Map<string, number>();

  for (const order of orders) {
    // Group active statuses (accepted, preparing, ready, for_delivery) as "in_progress"
    const key =
      ["accepted", "preparing", "ready", "for_delivery"].includes(order.status)
        ? "in_progress"
        : order.status;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const breakdown: OrderStatusBreakdown[] = [];
  for (const [status, count] of counts.entries()) {
    breakdown.push({
      status,
      label: STATUS_CHART_LABELS[status] ?? status,
      count,
      color: STATUS_CHART_COLORS[status] ?? "hsl(0, 0%, 60%)",
    });
  }

  // Sort: completed first, then pending, in_progress, cancelled
  const sortOrder = ["completed", "pending", "in_progress", "cancelled"];
  breakdown.sort((a, b) => sortOrder.indexOf(a.status) - sortOrder.indexOf(b.status));

  return { breakdown, total: orders.length };
}

// ── Farmer Top Products ───────────────────────────

export async function getFarmerTopProducts(
  farmerClerkId: string,
  limit: number = 5
): Promise<TopProduct[]> {
  const supabase = await createClient();

  // Get completed orders with their items
  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id, status,
      items:order_items(product_id, product_name, quantity, unit_price, unit)
    `)
    .eq("farmer_clerk_id", farmerClerkId)
    .eq("status", "completed");

  if (error) {
    console.error("[overview] getFarmerTopProducts error:", error.message);
    return [];
  }

  // Aggregate by product
  const productMap = new Map<
    string,
    { name: string; unit: string; unitsSold: number; revenue: number }
  >();

  for (const order of orders ?? []) {
    const items = order.items as Array<{
      product_id: string;
      product_name: string | null;
      quantity: number;
      unit_price: number;
      unit: string | null;
    }> | null;

    for (const item of items ?? []) {
      const existing = productMap.get(item.product_id) ?? {
        name: item.product_name ?? "Unknown Product",
        unit: item.unit ?? "kg",
        unitsSold: 0,
        revenue: 0,
      };
      existing.unitsSold += Number(item.quantity);
      existing.revenue += Number(item.quantity) * Number(item.unit_price);
      productMap.set(item.product_id, existing);
    }
  }

  // Get categories for the products
  const productIds = Array.from(productMap.keys());
  const categoryMap = new Map<string, string>();

  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, category:categories(name)")
      .in("id", productIds);

    for (const product of products ?? []) {
      const cat = product.category as { name: string } | null;
      if (cat) {
        categoryMap.set(product.id, cat.name);
      }
    }
  }

  return Array.from(productMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      category: categoryMap.get(id) ?? "Produce",
      unitsSold: data.unitsSold,
      unit: data.unit,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

// ── Business Overview KPIs ────────────────────────

export async function getBusinessOverviewKPIs(
  businessClerkId: string
): Promise<OverviewKPI> {
  const supabase = await createClient();

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, status, total_amount, farmer_clerk_id")
    .eq("business_clerk_id", businessClerkId);

  if (ordersError) {
    console.error("[overview] getBusinessOverviewKPIs orders error:", ordersError.message);
    return { totalOrders: 0, totalSales: 0, productsListed: 0, activeCustomers: 0 };
  }

  const allOrders = orders ?? [];
  const nonCancelledOrders = allOrders.filter((o) => o.status !== "cancelled");
  const totalSpend = nonCancelledOrders.reduce(
    (sum, o) => sum + (Number(o.total_amount) || 0),
    0
  );

  // Unique sellers (farmers)
  const uniqueSellers = new Set(allOrders.map((o) => o.farmer_clerk_id));

  // Count active products available to browse (not per-user)
  const { count: productsCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  return {
    totalOrders: allOrders.length,
    totalSales: totalSpend,
    productsListed: productsCount ?? 0,
    activeCustomers: uniqueSellers.size,
  };
}

// ── Business Spending Over Time ───────────────────

export async function getBusinessSpendingOverTime(
  businessClerkId: string,
  days: number = 7
): Promise<SalesDataPoint[]> {
  const supabase = await createClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startISO = startDate.toISOString();

  const { data, error } = await supabase
    .from("orders")
    .select("created_at, total_amount, status")
    .eq("business_clerk_id", businessClerkId)
    .gte("created_at", startISO)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[overview] getBusinessSpendingOverTime error:", error.message);
    return [];
  }

  const grouped = new Map<string, { sales: number; orders: number }>();
  for (let i = 0; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    grouped.set(key, { sales: 0, orders: 0 });
  }

  for (const row of data ?? []) {
    const d = new Date(row.created_at);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const existing = grouped.get(key) ?? { sales: 0, orders: 0 };
    existing.sales += Number(row.total_amount) || 0;
    existing.orders += 1;
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries()).map(([date, data]) => ({
    date,
    sales: data.sales,
    orders: data.orders,
  }));
}

// ── Business Order Status Breakdown ───────────────

export async function getBusinessOrderStatusBreakdown(
  businessClerkId: string
): Promise<{ breakdown: OrderStatusBreakdown[]; total: number }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .eq("business_clerk_id", businessClerkId);

  if (error) {
    console.error("[overview] getBusinessOrderStatusBreakdown error:", error.message);
    return { breakdown: [], total: 0 };
  }

  const orders = data ?? [];
  const counts = new Map<string, number>();

  for (const order of orders) {
    const key =
      ["accepted", "preparing", "ready", "for_delivery"].includes(order.status)
        ? "in_progress"
        : order.status;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const breakdown: OrderStatusBreakdown[] = [];
  for (const [status, count] of counts.entries()) {
    breakdown.push({
      status,
      label: STATUS_CHART_LABELS[status] ?? status,
      count,
      color: STATUS_CHART_COLORS[status] ?? "hsl(0, 0%, 60%)",
    });
  }

  const sortOrder = ["completed", "pending", "in_progress", "cancelled"];
  breakdown.sort((a, b) => sortOrder.indexOf(a.status) - sortOrder.indexOf(b.status));

  return { breakdown, total: orders.length };
}

