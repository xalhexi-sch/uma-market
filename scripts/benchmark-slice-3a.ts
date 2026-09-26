import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function runBenchmarks() {
  console.log("=== SLICE 3A QUERY BENCHMARKS ===");

  // 1. Farmer Active-Product Count: Full Product Fetch vs head: true Count
  console.log("\n--- Benchmark 1: Farmer Active-Product Count ---");
  const testFarmerId = "demo_farmer_verdant_ridge";

  // Before: full fetch of products table
  const t0 = performance.now();
  const { data: fullProducts } = await supabase
    .from("products")
    .select(`
      id, farmer_clerk_id, category_id, name, description,
      price_per_unit, unit, quantity_available, min_order_quantity,
      image_url, image_path, harvest_date, available_until, status, created_at, updated_at
    `)
    .eq("farmer_clerk_id", testFarmerId);
  const t1 = performance.now();
  const fullBytes = Buffer.byteLength(JSON.stringify(fullProducts ?? []));
  console.log(`Before (Full Fetch): ${(t1 - t0).toFixed(2)}ms, payload: ${fullBytes} bytes, count: ${fullProducts?.filter(p => p.status === 'active').length}`);

  // After: head: true DB count
  const t2 = performance.now();
  const { count: activeCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("farmer_clerk_id", testFarmerId)
    .eq("status", "active");
  const t3 = performance.now();
  console.log(`After (head: true Count): ${(t3 - t2).toFixed(2)}ms, payload: 0 bytes transferred, count: ${activeCount}`);

  // 2. Order Messages: 2 Roundtrips vs 1 Single Joined Roundtrip
  console.log("\n--- Benchmark 2: Order Messages Retrieval ---");
  // Find an order with messages
  const { data: sampleOrder } = await supabase.from("orders").select("id").limit(1).single();
  const orderId = sampleOrder?.id;

  if (orderId) {
    // Before: 2 sequential roundtrips (fetch messages, then fetch profiles)
    const t4 = performance.now();
    const { data: rawMsgs } = await supabase
      .from("messages")
      .select("id, order_id, sender_clerk_id, body, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    
    if (rawMsgs && rawMsgs.length > 0) {
      const senderIds = Array.from(new Set(rawMsgs.map(m => m.sender_clerk_id)));
      await supabase
        .from("profiles")
        .select("clerk_id, full_name, avatar_url, business_name")
        .in("clerk_id", senderIds);
    }
    const t5 = performance.now();
    console.log(`Before (2 Sequential Roundtrips): ${(t5 - t4).toFixed(2)}ms`);

    // After: 1 joined roundtrip
    const t6 = performance.now();
    await supabase
      .from("messages")
      .select(`
        id, order_id, sender_clerk_id, body, created_at,
        sender:profiles!messages_sender_clerk_id_fkey(clerk_id, full_name, avatar_url, business_name)
      `)
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    const t7 = performance.now();
    console.log(`After (1 Joined Single Roundtrip): ${(t7 - t6).toFixed(2)}ms`);
  }

  // 3. Orders Query Bounding: Unbounded vs LIMIT 3
  console.log("\n--- Benchmark 3: Orders History Bounding ---");
  const t8 = performance.now();
  const { data: unboundedOrders } = await supabase
    .from("orders")
    .select(`
      id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `)
    .order("created_at", { ascending: false });
  const t9 = performance.now();
  const unboundedBytes = Buffer.byteLength(JSON.stringify(unboundedOrders ?? []));
  console.log(`Before (Unbounded Orders): ${(t9 - t8).toFixed(2)}ms, payload: ${unboundedBytes} bytes, rows: ${unboundedOrders?.length}`);

  const t10 = performance.now();
  const { data: boundedOrders } = await supabase
    .from("orders")
    .select(`
      id, business_clerk_id, farmer_clerk_id, status, fulfillment_type,
      total_amount, notes, delivery_address, pickup_date,
      created_at, updated_at, accepted_at, completed_at, cancelled_at, cancellation_reason,
      items:order_items(id, order_id, product_id, product_name, unit, quantity, unit_price, subtotal, created_at)
    `)
    .order("created_at", { ascending: false })
    .limit(3);
  const t11 = performance.now();
  const boundedBytes = Buffer.byteLength(JSON.stringify(boundedOrders ?? []));
  console.log(`After (LIMIT 3 Bounded): ${(t11 - t10).toFixed(2)}ms, payload: ${boundedBytes} bytes, rows: ${boundedOrders?.length}`);
}

runBenchmarks().catch(console.error);
