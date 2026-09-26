import { createAdminClient } from "@/lib/supabase/admin";
import type { Product, Order, Profile, Message } from "@/lib/types";

export interface AdminMetrics {
  totalFarmers: number;
  totalBusinesses: number;
  totalProducts: number;
  totalOrders: number;
  totalVolume: number;
}

/**
 * Fetch platform-wide statistics for the admin dashboard.
 * Uses createAdminClient() (server-only, bypasses RLS for cross-tenant aggregates).
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const supabase = createAdminClient();

  const [farmersRes, bizRes, productsRes, ordersRes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "farmer"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "business"),
    supabase.from("products").select("*", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("orders").select("total_amount"),
  ]);

  const orders = ordersRes.data ?? [];
  const totalVolume = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  return {
    totalFarmers: farmersRes.count ?? 0,
    totalBusinesses: bizRes.count ?? 0,
    totalProducts: productsRes.count ?? 0,
    totalOrders: orders.length,
    totalVolume,
  };
}

/**
 * Fetch all products platform-wide for admin moderation.
 */
export async function getAdminProducts(): Promise<Product[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("products")
    .select(`
      id, farmer_clerk_id, category_id, name, description,
      price_per_unit, unit, quantity_available, min_order_quantity,
      image_url, image_path, harvest_date, available_until, status, created_at, updated_at,
      farmer:profiles!products_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, avatar_url, bio, is_verified),
      category:categories(id, name, slug)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] getAdminProducts error:", error.message);
    return [];
  }

  return (data ?? []).map((row): Product => ({
    id: row.id,
    farmer_clerk_id: row.farmer_clerk_id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    price_per_unit: Number(row.price_per_unit),
    unit: row.unit,
    quantity_available: Number(row.quantity_available),
    min_order_quantity: Number(row.min_order_quantity),
    image_url: row.image_url,
    image_path: row.image_path,
    harvest_date: row.harvest_date,
    available_until: row.available_until,
    status: row.status as Product["status"],
    created_at: row.created_at,
    updated_at: row.updated_at,
    farmer: row.farmer ?? undefined,
    category: row.category ?? undefined,
  }));
}

/**
 * Fetch all orders platform-wide for admin auditing.
 */
export async function getAdminOrders(): Promise<Order[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      farmer:profiles!orders_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, phone),
      business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city, phone, address),
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] getAdminOrders error:", error.message);
    return [];
  }

  return (data ?? []).map((row): Order => ({
    ...row,
    status: row.status as Order["status"],
    fulfillment_type: row.fulfillment_type as Order["fulfillment_type"],
    total_amount: row.total_amount ? Number(row.total_amount) : null,
    farmer: row.farmer ?? undefined,
    business: row.business ?? undefined,
    items: (row.items ?? []).map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      subtotal: Number(i.subtotal ?? Number(i.quantity) * Number(i.unit_price)),
    })),
  }));
}

/**
 * Fetch all registered profiles by role for admin user directory.
 */
export async function getAdminProfiles(role?: "farmer" | "business"): Promise<Profile[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (role) {
    query = query.eq("role", role);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[admin] getAdminProfiles error:", error.message);
    return [];
  }

  return (data ?? []) as Profile[];
}

/**
 * Fetch a single order by ID with full participant provenance, line items, and messages
 * for admin oversight and dispute inspection.
 */
export async function getAdminOrderById(orderId: string): Promise<{
  order: Order | null;
  messages: Message[];
}> {
  const supabase = createAdminClient();

  const [orderRes, messagesRes] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
        total_amount, notes, delivery_address, pickup_date,
        created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
        farmer:profiles!orders_farmer_clerk_id_fkey(clerk_id, full_name, business_name, city, phone),
        business:profiles!orders_business_clerk_id_fkey(clerk_id, full_name, business_name, city, phone, address),
        items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
      `)
      .eq("id", orderId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select(`
        id, order_id, sender_clerk_id, body, created_at,
        sender:profiles!messages_sender_clerk_id_fkey(clerk_id, full_name, avatar_url, business_name)
      `)
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  ]);

  if (orderRes.error || !orderRes.data) {
    if (orderRes.error) {
      console.error("[admin] getAdminOrderById error:", orderRes.error.message);
    }
    return { order: null, messages: [] };
  }

  const rawOrder = orderRes.data;
  const order: Order = {
    ...rawOrder,
    status: rawOrder.status as Order["status"],
    fulfillment_type: rawOrder.fulfillment_type as Order["fulfillment_type"],
    total_amount: rawOrder.total_amount ? Number(rawOrder.total_amount) : null,
    farmer: rawOrder.farmer ?? undefined,
    business: rawOrder.business ?? undefined,
    items: (rawOrder.items ?? []).map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      subtotal: Number(i.subtotal ?? Number(i.quantity) * Number(i.unit_price)),
    })),
  };

  const messages: Message[] = (messagesRes.data ?? []).map((m) => ({
    id: m.id,
    order_id: m.order_id,
    sender_clerk_id: m.sender_clerk_id,
    body: m.body,
    created_at: m.created_at,
    sender: m.sender ?? undefined,
  }));

  return {
    order,
    messages,
  };
}

