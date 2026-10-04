import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/constants";
import type { Order } from "@/lib/types";
import type { Json } from "@/lib/database.types";
import type { OverviewDateRange } from "@/lib/overview-range";

// ── Types ─────────────────────────────────────────

/**
 * Period-scoped Overview metrics. Every field is derived from the same
 * selected window (orders whose created_at falls inside the range):
 *
 *   revenue      = completed orders in the period
 *   pipeline     = open orders in the period
 *   orders       = orders created in the period
 *   activeBuyers = distinct counterparties with non-cancelled orders in the period
 *
 * `previous` holds the identical definitions over the previous window of
 * equal length, for delta comparisons.
 *
 * Aggregation happens in PostgreSQL (see the overview RPCs in
 * `supabase/migrations/20261005000001_overview_dashboard_aggregation.sql`);
 * this module only decodes the compact result.
 */
export interface OverviewMetrics {
  revenue: number;
  pipeline: number;
  orders: number;
  activeBuyers: number;
  previous: {
    revenue: number;
    pipeline: number;
    orders: number;
    activeBuyers: number;
  };
}

export interface BusinessOverviewMetrics extends OverviewMetrics {
  /** Snapshot: all active marketplace products (inventory, not period-scoped). */
  productsListed: number;
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

export interface FarmerOverviewData {
  metrics: OverviewMetrics;
  chart: SalesDataPoint[];
  status: { breakdown: OrderStatusBreakdown[]; total: number };
}

export interface BusinessOverviewData {
  metrics: BusinessOverviewMetrics;
  chart: SalesDataPoint[];
  status: { breakdown: OrderStatusBreakdown[]; total: number };
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

// ── Status colors / labels ────────────────────────

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

const STATUS_SORT_ORDER = ["completed", "pending", "in_progress", "cancelled"];

// ── Database-side aggregation (RPC) ───────────────

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type OverviewRpcName =
  | "get_farmer_overview_metrics"
  | "get_business_overview_metrics";

interface RpcChartPoint {
  day: string;
  sales: number;
  orders: number;
}

interface RpcStatusCount {
  status: string;
  count: number;
}

interface OverviewAggregate {
  metrics: OverviewMetrics;
  chart: RpcChartPoint[];
  status: RpcStatusCount[];
}

function asObject(value: Json | undefined): Record<string, Json | undefined> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
}

function asNumber(value: Json | undefined): number {
  return typeof value === "number" ? value : 0;
}

function asString(value: Json | undefined): string {
  return typeof value === "string" ? value : "";
}

function readMetrics(raw: Record<string, Json | undefined> | null): OverviewMetrics {
  const current = raw ?? {};
  const previous = asObject(current.previous) ?? {};

  return {
    revenue: asNumber(current.revenue),
    pipeline: asNumber(current.pipeline),
    orders: asNumber(current.orders),
    activeBuyers: asNumber(current.active_buyers),
    previous: {
      revenue: asNumber(previous.revenue),
      pipeline: asNumber(previous.pipeline),
      orders: asNumber(previous.orders),
      activeBuyers: asNumber(previous.active_buyers),
    },
  };
}

function readRows(
  value: Json | undefined,
): Array<Record<string, Json | undefined>> {
  if (!Array.isArray(value)) return [];
  return value.map(asObject).filter((row): row is Record<string, Json | undefined> => row !== null);
}

/**
 * Decodes the compact JSON document returned by the overview RPCs. The
 * payload is validated field by field instead of cast wholesale: the database
 * is a trust boundary and a shape change must degrade to zeros/empties, not
 * to `NaN` rendered as a KPI.
 */
function decodeOverviewAggregate(payload: Json | null): OverviewAggregate {
  const root = asObject(payload ?? null);
  if (!root) {
    throw new Error("[overview] overview RPC returned an unexpected payload");
  }

  return {
    metrics: readMetrics(asObject(root.metrics)),
    chart: readRows(root.chart).map((row) => ({
      day: asString(row.day),
      sales: asNumber(row.sales),
      orders: asNumber(row.orders),
    })),
    status: readRows(root.status).map((row) => ({
      status: asString(row.status),
      count: asNumber(row.count),
    })),
  };
}

/**
 * Runs one period aggregation RPC. Only the three window instants (derived
 * from the shared Phase 1 range model) are sent — the caller's Clerk identity
 * and role are read from the JWT inside the function, and RLS on `orders`
 * still applies because the function is SECURITY INVOKER.
 */
async function fetchOverviewAggregate(
  supabase: SupabaseServerClient,
  rpcName: OverviewRpcName,
  range: OverviewDateRange,
): Promise<OverviewAggregate> {
  const { data, error } = await supabase.rpc(rpcName, {
    p_prev_start: range.previous.startIso,
    p_start: range.startIso,
    p_end: range.endIso,
  });

  if (error) throw error;

  return decodeOverviewAggregate(data);
}

/** Label for a Manila day key, e.g. "Oct 5" (anchored to the key itself). */
function dayKeyLabel(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** One bucket per Manila day of the period, already zero-filled by SQL. */
function buildChart(points: RpcChartPoint[]): SalesDataPoint[] {
  return points.map((point) => ({
    date: dayKeyLabel(point.day),
    sales: point.sales,
    orders: point.orders,
  }));
}

function buildStatusBreakdown(counts: RpcStatusCount[]) {
  const breakdown: OrderStatusBreakdown[] = counts.map((row) => ({
    status: row.status,
    label: STATUS_CHART_LABELS[row.status] ?? row.status,
    count: row.count,
    color: STATUS_CHART_COLORS[row.status] ?? "hsl(0, 0%, 60%)",
  }));

  breakdown.sort(
    (a, b) => STATUS_SORT_ORDER.indexOf(a.status) - STATUS_SORT_ORDER.indexOf(b.status),
  );

  return { breakdown, total: counts.reduce((sum, row) => sum + row.count, 0) };
}

// ── Farmer Overview ───────────────────────────────

export async function getFarmerOverview(
  range: OverviewDateRange,
): Promise<FarmerOverviewData> {
  const supabase = await createClient();
  const aggregate = await fetchOverviewAggregate(
    supabase,
    "get_farmer_overview_metrics",
    range,
  );

  return {
    metrics: aggregate.metrics,
    chart: buildChart(aggregate.chart),
    status: buildStatusBreakdown(aggregate.status),
  };
}

// ── Business Overview ─────────────────────────────

export async function getBusinessOverview(
  range: OverviewDateRange,
): Promise<BusinessOverviewData> {
  const supabase = await createClient();
  const aggregate = await fetchOverviewAggregate(
    supabase,
    "get_business_overview_metrics",
    range,
  );

  const { count: productsListed, error: productsError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (productsError) throw productsError;

  return {
    metrics: {
      ...aggregate.metrics,
      productsListed: productsListed ?? 0,
    },
    chart: buildChart(aggregate.chart),
    status: buildStatusBreakdown(aggregate.status),
  };
}

// ── Farmer Top Products (period-scoped) ───────────

export async function getFarmerTopProducts(
  farmerClerkId: string,
  range: OverviewDateRange,
  limit: number = 5,
): Promise<TopProduct[]> {
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id, status,
      items:order_items(product_id, product_name, quantity, unit_price, unit)
    `)
    .eq("farmer_clerk_id", farmerClerkId)
    .eq("status", "completed")
    .gte("created_at", range.startIso)
    .lt("created_at", range.endIso);

  if (error) throw error;

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
    const { data: products, error: categoriesError } = await supabase
      .from("products")
      .select("id, category:categories(name)")
      .in("id", productIds);

    if (categoriesError) throw categoriesError;

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
