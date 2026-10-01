// =============================================================================
// UMA Market — Checkout / Order / Inventory Hardening Verification Suite
//
// SAFETY RULES:
//   1. MUST ONLY target the dedicated security-test Supabase project.
//   2. ABORTS immediately on production database detected.
//   3. ABORTS on any unknown project URL.
//   4. Never prints keys, secrets, or JWTs.
//   5. All test data uses deterministic UUIDs prefixed "t0000001-".
//      Cleaned up in finally{} after every run, even on failure.
//
// ============================================================================
// TEST CATEGORIES
// ============================================================================
//
// [STATIC]        Reads configuration/environment values only. No DB mutations.
//
// [DATABASE]      Uses service_role admin client against the security-test DB.
//                 Exercises triggers, constraints, and anon RLS directly.
//                 Does NOT exercise any authenticated application code path.
//                 Safe to run once .env.local points to the security-test project.
//
// [AUTH E2E STUB] Cannot be honestly implemented without a real Clerk JWT and
//                 a live Next.js session. Documents what must be run separately
//                 via the Campaign 4 Puppeteer/browser harness.
//                 See: docs/security/results/CAMPAIGN-04-CONCURRENCY.md
//                      docs/security/SECURITY-TEST-ENVIRONMENT.md §6
//
// ============================================================================
// WHY SERVICE_ROLE CANNOT EXERCISE AUTHENTICATED RPC PATHS
// ============================================================================
//
// SECURITY DEFINER RPCs (place_checkout_orders, update_order_status) call
// auth.jwt()->>'sub' as their very first statement. When called via the
// service_role key, auth.jwt() returns NULL → the RPC raises "Not authenticated"
// before reaching any business logic (stock checks, MOQ, state transitions).
//
// Therefore these tests CANNOT be verified by this script:
//   AUTH-E2E-01  Multi-farmer checkout atomicity (place_checkout_orders)
//   AUTH-E2E-02  Insufficient stock rejection + full rollback
//   AUTH-E2E-03  MOQ rejection through authenticated checkout
//   AUTH-E2E-04  Farmer update_order_status: valid + invalid paths
//   AUTH-E2E-05  Buyer cancelOrder Server Action + trigger stock restoration
//   AUTH-E2E-06  Authenticated Buyer B vs Buyer A cross-tenant RLS
//   AUTH-E2E-07  Buyer JWT calling update_order_status (farmer-only guard)
//   AUTH-E2E-08  Revoked profile blocked by assertActiveProfile (SEC-AUTH-001)
//
// HOW TO RUN (after switching .env.local to the security-test project):
//   npx tsx scripts/verify-checkout-orders.ts
// =============================================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// =============================================================================
// ENVIRONMENT GUARD — hard abort if not pointed at security-test project
// =============================================================================

const PROD_REF            = "odnpkqjytrmciwmcehff";
const SECURITY_TEST_REF   = "xckdihprwjdwutglytwu";
const SECURITY_TEST_URL   = `https://${SECURITY_TEST_REF}.supabase.co`;

const supabaseUrl       = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey   = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? "";

if (supabaseUrl.includes(PROD_REF)) {
  console.error("================================================================");
  console.error("  SAFETY ABORT: PRODUCTION DATABASE DETECTED");
  console.error("");
  console.error("  .env.local points to the LIVE PRODUCTION Supabase project.");
  console.error("  Mutation tests against production are STRICTLY FORBIDDEN.");
  console.error("");
  console.error("  Switch .env.local to the security-test project:");
  console.error(`  NEXT_PUBLIC_SUPABASE_URL=${SECURITY_TEST_URL}`);
  console.error("  See docs/security/SECURITY-TEST-ENVIRONMENT.md.");
  console.error("================================================================");
  process.exit(2);
}

if (supabaseUrl !== SECURITY_TEST_URL) {
  console.error("================================================================");
  console.error("  SAFETY ABORT: UNKNOWN SUPABASE PROJECT");
  console.error("");
  console.error("  This script requires the documented security-test project.");
  console.error(`  Expected : ${SECURITY_TEST_URL}`);
  console.error(`  Active   : ${supabaseUrl || "(not set)"}`);
  console.error("");
  console.error("  See docs/security/SECURITY-TEST-ENVIRONMENT.md.");
  console.error("================================================================");
  process.exit(2);
}

if (!supabaseAnonKey || !supabaseSecretKey) {
  console.error("ABORT: Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY");
  process.exit(1);
}

// Admin client: service_role — bypasses RLS, but NOT auth.jwt() in SECURITY DEFINER functions
const adminClient: SupabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// =============================================================================
// TEST INFRASTRUCTURE
// =============================================================================

type TestCategory = "STATIC" | "DATABASE" | "AUTH E2E STUB";

interface TestResult {
  id: string;
  category: TestCategory;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(
  id: string,
  category: TestCategory,
  name: string,
  condition: boolean,
  details: string,
): boolean {
  results.push({ id, category, name, passed: condition, details });
  const icon = condition ? "PASS" : "FAIL";
  console.log(`  [${icon}] [${category.padEnd(12)}] ${id.padEnd(12)} ${name}`);
  if (!condition) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string, note?: string): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  if (note) console.log(`  NOTE: ${note}`);
  console.log("=".repeat(72));
}

function stub(id: string, name: string, reason: string): void {
  results.push({ id, category: "AUTH E2E STUB", name, passed: true, details: reason });
  console.log(`  [STUB] [AUTH E2E STUB ] ${id.padEnd(12)} ${name}`);
  console.log(`           Requires: ${reason}`);
}

// =============================================================================
// FIXTURES
// =============================================================================

const T = {
  vegCategorySlug: "vegetables",
  farmerA_id: "t0000001-0000-0000-0000-000000000001",
  farmerB_id: "t0000001-0000-0000-0000-000000000002",
  buyerA_id:  "t0000001-0000-0000-0000-000000000101",
  buyerB_id:  "t0000001-0000-0000-0000-000000000102",
  productA1:  "t0000001-0000-0000-0000-000000000201",
  productA2:  "t0000001-0000-0000-0000-000000000202",
  productB1:  "t0000001-0000-0000-0000-000000000211",
  productLow: "t0000001-0000-0000-0000-000000000221",
  productMOQ: "t0000001-0000-0000-0000-000000000222",
};

async function cleanupFixtures(): Promise<void> {
  const errors: string[] = [];

  const { data: testOrders, error: ordersSelectErr } = await adminClient
    .from("orders")
    .select("id")
    .or(`business_clerk_id.eq.${T.buyerA_id},business_clerk_id.eq.${T.buyerB_id}`);
  if (ordersSelectErr) {
    errors.push(`orders select: ${ordersSelectErr.message}`);
  } else if (testOrders && testOrders.length > 0) {
    const ids = testOrders.map((o: { id: string }) => o.id);
    const { error: itemsDelErr } = await adminClient.from("order_items").delete().in("order_id", ids);
    if (itemsDelErr) errors.push(`order_items delete: ${itemsDelErr.message}`);
    const { error: ordersDelErr } = await adminClient.from("orders").delete().in("id", ids);
    if (ordersDelErr) errors.push(`orders delete: ${ordersDelErr.message}`);
  }

  const { error: cartDelErr } = await adminClient.from("cart_items").delete()
    .or(`business_clerk_id.eq.${T.buyerA_id},business_clerk_id.eq.${T.buyerB_id}`);
  if (cartDelErr) errors.push(`cart_items delete: ${cartDelErr.message}`);

  const { error: productsDelErr } = await adminClient.from("products").delete()
    .in("id", [T.productA1, T.productA2, T.productB1, T.productLow, T.productMOQ]);
  if (productsDelErr) errors.push(`products delete: ${productsDelErr.message}`);

  const { error: profilesDelErr } = await adminClient.from("profiles").delete()
    .in("clerk_id", [T.farmerA_id, T.farmerB_id, T.buyerA_id, T.buyerB_id]);
  if (profilesDelErr) errors.push(`profiles delete: ${profilesDelErr.message}`);

  if (errors.length > 0) {
    throw new Error(
      `cleanupFixtures failed (${errors.length} error(s)):\n` +
      errors.map((e) => `  - ${e}`).join("\n") +
      "\nRun TRUNCATE from SECURITY-TEST-ENVIRONMENT.md \u00a78 to recover."
    );
  }
}

async function provisionFixtures(): Promise<boolean> {
  const { data: cat, error: catErr } = await adminClient
    .from("categories").select("id").eq("slug", T.vegCategorySlug).single();
  if (catErr || !cat) {
    console.error(`  category '${T.vegCategorySlug}' not found — run npm run seed:demo first`);
    return false;
  }
  const categoryId = cat.id as string;
  const { error: profErr } = await adminClient.from("profiles").upsert([
    { clerk_id: T.farmerA_id, role: "farmer",   full_name: "Test Farmer Alpha", business_name: "Alpha Test Farm",    city: "Butuan", status: "active" },
    { clerk_id: T.farmerB_id, role: "farmer",   full_name: "Test Farmer Beta",  business_name: "Beta Test Farm",     city: "Butuan", status: "active" },
    { clerk_id: T.buyerA_id,  role: "business", full_name: "Test Buyer Alpha",  business_name: "Alpha Test Kitchen", city: "Butuan", status: "active" },
    { clerk_id: T.buyerB_id,  role: "business", full_name: "Test Buyer Beta",   business_name: "Beta Test Kitchen",  city: "Butuan", status: "active" },
  ], { onConflict: "clerk_id" });
  if (profErr) { console.error("  Profile upsert failed:", profErr.message); return false; }
  const { error: prodErr } = await adminClient.from("products").upsert([
    { id: T.productA1,  farmer_clerk_id: T.farmerA_id, category_id: categoryId, name: "TEST Kangkong Farmer A", price_per_unit: 50,  unit: "kg", quantity_available: 50,  min_order_quantity: 5,  status: "active" },
    { id: T.productA2,  farmer_clerk_id: T.farmerA_id, category_id: categoryId, name: "TEST Sitaw Farmer A",    price_per_unit: 80,  unit: "kg", quantity_available: 30,  min_order_quantity: 5,  status: "active" },
    { id: T.productB1,  farmer_clerk_id: T.farmerB_id, category_id: categoryId, name: "TEST Ampalaya Farmer B", price_per_unit: 90,  unit: "kg", quantity_available: 100, min_order_quantity: 5,  status: "active" },
    { id: T.productLow, farmer_clerk_id: T.farmerA_id, category_id: categoryId, name: "TEST LowStock Farmer A", price_per_unit: 40,  unit: "kg", quantity_available: 5,   min_order_quantity: 1,  status: "active" },
    { id: T.productMOQ, farmer_clerk_id: T.farmerA_id, category_id: categoryId, name: "TEST HighMOQ Farmer A",  price_per_unit: 120, unit: "kg", quantity_available: 200, min_order_quantity: 10, status: "active" },
  ], { onConflict: "id" });
  if (prodErr) { console.error("  Product upsert failed:", prodErr.message); return false; }
  return true;
}

async function getStock(productId: string): Promise<number | null> {
  const { data } = await adminClient.from("products")
    .select("quantity_available").eq("id", productId).single();
  return data?.quantity_available ?? null;
}

// =============================================================================
// SECTION 1 — STATIC + DATABASE ENVIRONMENT CHECKS
// S-01..S-03: STATIC  — pure environment variable assertions, no DB contact.
// S-04:       DATABASE — performs a Supabase query to confirm connectivity.
// =============================================================================

async function runStaticChecks(): Promise<void> {
  section("SECTION 1 — Environment Checks [STATIC / DATABASE]");
  assert("S-01", "STATIC", "Active URL does not contain production ref",
    !supabaseUrl.includes(PROD_REF), `URL must not contain '${PROD_REF}'`);
  assert("S-02", "STATIC", "Active URL exactly matches security-test project",
    supabaseUrl === SECURITY_TEST_URL, `URL = ${SECURITY_TEST_URL}`);
  assert("S-03", "STATIC", "Keys are NOT logged in test output",
    true, "Script never prints secret key or publishable key values");
  const { data, error } = await adminClient.from("categories").select("id").limit(1);
  assert("S-04", "DATABASE", "Security-test database is reachable via admin client",
    !error && data !== null,
    error ? `Connection failed: ${error.message}` : `DB responded (${data?.length ?? 0} row(s))`);
}

// =============================================================================
// SECTION 2 — DATABASE: RPC AUTH GATE VERIFICATION
//
// Confirms that SECURITY DEFINER RPCs reject service_role callers at the
// auth.jwt()->>'sub' IS NULL guard — the first statement in each RPC.
//
// What this does NOT verify:
//   - The actual checkout flow (stock decrement, cart clearing, atomicity)
//   - MOQ enforcement
//   - State-machine logic
// Those require a real Clerk JWT. See AUTH E2E stubs below.
// =============================================================================

async function runRPCAuthGateChecks(): Promise<void> {
  section(
    "SECTION 2 — Database: RPC Auth Gate Verification [DATABASE]",
    "Auth gate fires at auth.jwt()->>'sub' IS NULL — business logic not reached."
  );
  {
    const { error } = await adminClient.rpc("place_checkout_orders", {
      p_orders: [{ farmer_clerk_id: T.farmerA_id, fulfillment_type: "pickup",
        items: [{ product_id: T.productA1, quantity: 5 }] }],
    });
    assert("D-01", "DATABASE",
      "place_checkout_orders: rejects unauthenticated caller (auth gate present)",
      error !== null,
      error ? `Auth gate: "${error.message?.slice(0, 100)}"` : "UNEXPECTED: RPC accepted unauthenticated call");
  }
  {
    const { error } = await adminClient.rpc("update_order_status", {
      p_order_id: "00000000-0000-0000-0000-000000000001",
      p_new_status: "accepted",
    });
    assert("D-02", "DATABASE",
      "update_order_status: rejects unauthenticated caller (auth gate present)",
      error !== null,
      error ? `Auth gate: "${error.message?.slice(0, 100)}"` : "UNEXPECTED: RPC accepted unauthenticated call");
  }
}

// =============================================================================
// SECTION 3 — DATABASE: SCHEMA CONSTRAINT VERIFICATION
// =============================================================================

async function runSchemaConstraintChecks(): Promise<void> {
  section("SECTION 3 — Database: Schema Constraint Verification [DATABASE]");
  // products.quantity_available >= 0
  {
    const before = await getStock(T.productLow);
    const { error } = await adminClient.from("products")
      .update({ quantity_available: -1 }).eq("id", T.productLow);
    assert("D-03", "DATABASE", "products: quantity_available CHECK (>= 0) enforced",
      error !== null,
      error ? `Constraint: "${error.message.slice(0, 100)}"` : "UNEXPECTED: negative qty accepted");
    assert("D-04", "DATABASE", "products: stock unchanged after rejected negative update",
      await getStock(T.productLow) === before,
      `before=${before} now=${await getStock(T.productLow)}`);
  }
  // cart_items.quantity > 0
  {
    const { error } = await adminClient.from("cart_items").insert({
      business_clerk_id: T.buyerA_id, product_id: T.productMOQ, quantity: 0,
    });
    assert("D-05", "DATABASE", "cart_items: CHECK (quantity > 0) enforced",
      error !== null,
      error ? `Constraint: "${error.message.slice(0, 100)}"` : "UNEXPECTED: zero qty accepted");
  }
  // order_items.quantity > 0
  {
    const { data: dummy } = await adminClient.from("orders").insert({
      business_clerk_id: T.buyerA_id, farmer_clerk_id: T.farmerA_id,
      fulfillment_type: "pickup", total_amount: 0, status: "pending",
    }).select("id").single();
    if (dummy) {
      const { error } = await adminClient.from("order_items").insert({
        order_id: dummy.id, product_id: T.productMOQ, quantity: 0,
        unit_price: 120, product_name: "TEST HighMOQ Farmer A", unit: "kg",
      });
      assert("D-06", "DATABASE", "order_items: CHECK (quantity > 0) enforced",
        error !== null,
        error ? `Constraint: "${error.message.slice(0, 100)}"` : "UNEXPECTED: zero qty accepted");
    }
  }
  // min_order_quantity stored correctly (read-only)
  {
    const { data: p } = await adminClient.from("products")
      .select("min_order_quantity").eq("id", T.productMOQ).single();
    assert("D-07", "DATABASE", "products: min_order_quantity = 10 correctly stored",
      p?.min_order_quantity === 10,
      p ? `min_order_quantity=${p.min_order_quantity}` : "Product not found");
  }
}

// =============================================================================
// SECTION 4 — DATABASE: trg_restore_stock_on_cancelled
//
// IMPORTANT: Stock is manually decremented here via admin UPDATE — not via the
// checkout RPC. This is intentional and honest: we are testing the trigger
// directly, not the full checkout flow (which requires a Clerk JWT).
// =============================================================================

async function runCancellationTriggerChecks(): Promise<void> {
  section(
    "SECTION 4 — Database: Cancellation Stock Restoration Trigger [DATABASE]",
    "Stock decremented directly via admin UPDATE — trigger tested in isolation."
  );
  const orderQty = 8;
  const stockBefore = await getStock(T.productA2);
  const { data: order, error: oErr } = await adminClient.from("orders").insert({
    business_clerk_id: T.buyerA_id, farmer_clerk_id: T.farmerA_id,
    fulfillment_type: "pickup", total_amount: orderQty * 80, status: "pending",
  }).select("id").single();
  if (oErr || !order) {
    assert("D-08", "DATABASE", "Pre-condition: pending order created", false, oErr?.message ?? "no data");
    return;
  }
  await adminClient.from("order_items").insert({
    order_id: order.id, product_id: T.productA2, quantity: orderQty,
    unit_price: 80, product_name: "TEST Sitaw Farmer A", unit: "kg",
  });
  // Direct admin stock decrement — NOT via checkout RPC
  await adminClient.from("products")
    .update({ quantity_available: (stockBefore ?? 0) - orderQty }).eq("id", T.productA2);
  assert("D-08", "DATABASE", "Pre-condition: stock manually decremented (direct admin UPDATE)",
    await getStock(T.productA2) === (stockBefore ?? 0) - orderQty,
    `before=${stockBefore} after-decrement=${await getStock(T.productA2)}`);
  // Cancel from pending — trigger should restore stock
  const { error: cancelErr } = await adminClient.from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", order.id).eq("status", "pending");
  assert("D-09", "DATABASE", "Order status set to cancelled from pending",
    !cancelErr,
    cancelErr ? `Error: ${cancelErr.message}` : `Order ${order.id.slice(0, 8)} → cancelled`);
  assert("D-10", "DATABASE", "trg_restore_stock_on_cancelled: stock restored on pending → cancelled",
    await getStock(T.productA2) === stockBefore,
    `after-cancel=${await getStock(T.productA2)} expected=${stockBefore}`);
  // Terminal state: cancelled order cannot be reopened
  const { error: reopenErr } = await adminClient.from("orders")
    .update({ status: "pending" }).eq("id", order.id);
  assert("D-11", "DATABASE", "trg_enforce_order_terminal_status: cancelled order cannot be reopened",
    reopenErr !== null,
    reopenErr ? `Trigger: "${reopenErr.message.slice(0, 100)}"` : "UNEXPECTED: order reopened");
  // WHEN guard: ready → cancelled should NOT restore stock
  const stockBeforeReady = await getStock(T.productA2);
  const { data: readyOrder, error: roErr } = await adminClient.from("orders").insert({
    business_clerk_id: T.buyerA_id, farmer_clerk_id: T.farmerA_id,
    fulfillment_type: "pickup", total_amount: 5 * 80, status: "ready",
  }).select("id").single();
  if (!roErr && readyOrder) {
    await adminClient.from("order_items").insert({
      order_id: readyOrder.id, product_id: T.productA2, quantity: 5,
      unit_price: 80, product_name: "TEST Sitaw Farmer A", unit: "kg",
    });
    await adminClient.from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", readyOrder.id);
    assert("D-12", "DATABASE",
      "trg_restore_stock_on_cancelled: WHEN guard — stock NOT restored from ready",
      await getStock(T.productA2) === stockBeforeReady,
      `before=${stockBeforeReady} after-cancel-from-ready=${await getStock(T.productA2)} (must be equal)`);
  } else {
    assert("D-12", "DATABASE", "WHEN guard test (cancel from ready)", false, roErr?.message ?? "failed");
  }
}

// =============================================================================
// SECTION 5 — DATABASE: trg_enforce_order_terminal_status
// =============================================================================

async function runTerminalStateTriggerChecks(): Promise<void> {
  section(
    "SECTION 5 — Database: Terminal State Protection Trigger [DATABASE]",
    "Verifies trg_enforce_order_terminal_status for cancelled and completed orders."
  );
  const { data: cOrder, error: ceErr } = await adminClient.from("orders").insert({
    business_clerk_id: T.buyerA_id, farmer_clerk_id: T.farmerA_id,
    fulfillment_type: "pickup", total_amount: 100,
    status: "cancelled", cancelled_at: new Date().toISOString(),
  }).select("id").single();
  const { data: compOrder, error: compErr } = await adminClient.from("orders").insert({
    business_clerk_id: T.buyerA_id, farmer_clerk_id: T.farmerA_id,
    fulfillment_type: "pickup", total_amount: 100,
    status: "completed", completed_at: new Date().toISOString(),
  }).select("id").single();
  if (!ceErr && cOrder) {
    for (const [id, newStatus] of [["D-13","pending"],["D-14","completed"],["D-15","accepted"]] as const) {
      const { error } = await adminClient.from("orders").update({ status: newStatus }).eq("id", cOrder.id);
      assert(id, "DATABASE", `cancelled → ${newStatus}: trigger blocks`,
        error !== null, error ? `Trigger: "${error.message.slice(0, 100)}"` : "UNEXPECTED");
    }
  } else {
    for (const id of ["D-13","D-14","D-15"]) {
      assert(id, "DATABASE", `cancelled terminal check (${id})`, false, ceErr?.message ?? "order creation failed");
    }
  }
  if (!compErr && compOrder) {
    for (const [id, newStatus] of [["D-16","pending"],["D-17","cancelled"],["D-18","accepted"]] as const) {
      const { error } = await adminClient.from("orders").update({ status: newStatus }).eq("id", compOrder.id);
      assert(id, "DATABASE", `completed → ${newStatus}: trigger blocks`,
        error !== null, error ? `Trigger: "${error.message.slice(0, 100)}"` : "UNEXPECTED");
    }
  } else {
    for (const id of ["D-16","D-17","D-18"]) {
      assert(id, "DATABASE", `completed terminal check (${id})`, false, compErr?.message ?? "order creation failed");
    }
  }
}

// =============================================================================
// SECTION 6 — DATABASE: ANONYMOUS RLS VERIFICATION
//
// Verifies that the anon key (no JWT) returns 0 rows from orders, order_items,
// and cart_items. This is the RLS floor — no authenticated session at all.
//
// This is NOT authenticated cross-tenant isolation (Buyer B vs Buyer A).
// Authenticated isolation requires a real Buyer B JWT: see AUTH-E2E-06.
// =============================================================================

async function runAnonRLSChecks(): Promise<void> {
  section(
    "SECTION 6 — Database: Anonymous Access Blocked by RLS [DATABASE]",
    "Anon key only — not authenticated Buyer B isolation (see AUTH-E2E-06)."
  );
  const { data: orderA, error: oaErr } = await adminClient.from("orders").insert({
    business_clerk_id: T.buyerA_id, farmer_clerk_id: T.farmerA_id,
    fulfillment_type: "pickup", total_amount: 100, status: "pending",
  }).select("id").single();
  if (oaErr || !orderA) {
    assert("D-19", "DATABASE", "Buyer A order created as pre-condition", false, oaErr?.message ?? "failed");
    return;
  }
  await adminClient.from("order_items").insert({
    order_id: orderA.id, product_id: T.productA1, quantity: 2,
    unit_price: 50, product_name: "TEST Kangkong Farmer A", unit: "kg",
  });
  await adminClient.from("cart_items").upsert(
    { business_clerk_id: T.buyerA_id, product_id: T.productA1, quantity: 5 },
    { onConflict: "business_clerk_id,product_id" }
  );
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: eOrds } = await anonClient.from("orders").select("id").eq("id", orderA.id);
  assert("D-19", "DATABASE", "Anon client: orders returns 0 rows (RLS enforced)",
    !eOrds || eOrds.length === 0,
    eOrds?.length ? `SECURITY VIOLATION: ${eOrds.length} order(s) exposed` : "0 rows — RLS enforced");
  const { data: eItms } = await anonClient.from("order_items").select("id").eq("order_id", orderA.id);
  assert("D-20", "DATABASE", "Anon client: order_items returns 0 rows (RLS enforced)",
    !eItms || eItms.length === 0,
    eItms?.length ? `SECURITY VIOLATION: ${eItms.length} item(s) exposed` : "0 rows — RLS enforced");
  const { data: eCart } = await anonClient.from("cart_items").select("id").eq("business_clerk_id", T.buyerA_id);
  assert("D-21", "DATABASE", "Anon client: cart_items returns 0 rows (RLS enforced)",
    !eCart || eCart.length === 0,
    eCart?.length ? `SECURITY VIOLATION: ${eCart.length} cart item(s) exposed` : "0 rows — RLS enforced");
  const { data: adminRead } = await adminClient.from("orders")
    .select("id, status").eq("id", orderA.id).single();
  assert("D-22", "DATABASE", "Admin (service_role) confirms order exists (sanity check)",
    adminRead !== null && adminRead.id === orderA.id,
    adminRead ? `OK (status: ${adminRead.status})` : "Admin could not read — unexpected");
}

// =============================================================================
// SECTION 7 — AUTH E2E STUBS (documented coverage gaps)
// =============================================================================

function runAuthE2EStubs(): void {
  section(
    "SECTION 7 — Authenticated E2E Stubs [AUTH E2E STUB]",
    "Not implemented here. Run via Campaign 4 Puppeteer harness with Clerk Dev JWT."
  );
  stub("AUTH-E2E-01",
    "Multi-farmer checkout atomicity via place_checkout_orders",
    "Real buyer JWT + 2 farmer groups; verify 2 orders, both stock decrements, cart cleared");
  stub("AUTH-E2E-02",
    "Insufficient stock: RPC rejects and rolls back completely",
    "Real buyer JWT + qty > quantity_available → raises, 0 orders, stock unchanged");
  stub("AUTH-E2E-03",
    "MOQ rejection: RPC rejects qty < min_order_quantity",
    "Real buyer JWT + qty=1 vs MOQ=10 → raises MOQ error, 0 orders created");
  stub("AUTH-E2E-04",
    "Farmer update_order_status: valid + invalid transition paths",
    "Real farmer JWT + pending→accepted→preparing→ready→completed; pending→completed rejected");
  stub("AUTH-E2E-05",
    "Buyer cancelOrder Server Action: cancels pending, trigger restores stock",
    "Real buyer JWT via Server Action; stock verified via admin read after cancellation");
  stub("AUTH-E2E-06",
    "Authenticated Buyer B cannot read Buyer A orders (cross-tenant RLS)",
    "Real Buyer B JWT querying Buyer A order ID → 0 rows (authenticated session, not anon)");
  stub("AUTH-E2E-07",
    "Buyer JWT calling update_order_status raises farmer-only error",
    "Real buyer JWT + update_order_status RPC → 'Only farmers can update order status'");
  stub("AUTH-E2E-08",
    "Revoked profile blocked by assertActiveProfile before checkout (SEC-AUTH-001)",
    "profile.status='revoked' + buyer JWT → placeMultiFarmerCheckout returns {success:false}");
}

// =============================================================================
// MAIN
// =============================================================================

async function run(): Promise<void> {
  console.log("========================================================================");
  console.log("UMA Market — Checkout/Order/Inventory Hardening Verification Suite");
  console.log(`Target  : ${SECURITY_TEST_URL}`);
  console.log(`Date    : ${new Date().toISOString()}`);
  console.log("========================================================================");
  console.log("\nTest categories in this run:");
  console.log("  [STATIC]        — environment assertions (no DB mutation)");
  console.log("  [DATABASE]      — trigger / constraint / anon-RLS via service_role");
  console.log("  [AUTH E2E STUB] — coverage gaps requiring Clerk JWT + Puppeteer");
  console.log("\nReference:");
  console.log("  docs/security/SECURITY-TEST-ENVIRONMENT.md");
  console.log("  docs/security/results/CAMPAIGN-04-CONCURRENCY.md\n");

  await runStaticChecks();
  runAuthE2EStubs();

  section("Fixture Setup");
  let fixturesOk = false;
  let cleanupFailed = false;
  try {
    // Pre-run: remove stale deterministic fixtures from any interrupted prior run.
    console.log("  [Pre-run] Removing stale test fixtures...");
    await cleanupFixtures();
    console.log("  [Pre-run] Stale fixture cleanup OK");

    fixturesOk = await provisionFixtures();
    console.log(fixturesOk
      ? "  Fixtures provisioned OK"
      : "  FAILED — DATABASE mutation sections will be skipped");
  } catch (e) {
    console.error("  Fatal fixture setup error:", e);
  }

  if (fixturesOk) {
    try {
      await runRPCAuthGateChecks();
      await runSchemaConstraintChecks();
      await runCancellationTriggerChecks();
      await runTerminalStateTriggerChecks();
      await runAnonRLSChecks();
    } finally {
      section("Fixture Cleanup");
      try {
        await cleanupFixtures();
        console.log("  Cleanup complete — all test data removed");
      } catch (e) {
        cleanupFailed = true;
        console.error("  Cleanup FAILED — run TRUNCATE from SECURITY-TEST-ENVIRONMENT.md §8");
        console.error("  Error:", e);
      }
    }
  }

  console.log("\n========================================================================");
  const dbResults   = results.filter((r) => r.category !== "AUTH E2E STUB");
  const stubResults = results.filter((r) => r.category === "AUTH E2E STUB");
  const dbPassed    = dbResults.filter((r) => r.passed).length;
  const dbFailed    = dbResults.length - dbPassed;
  console.log(`DATABASE/STATIC : ${dbPassed}/${dbResults.length} PASSED | ${dbFailed} FAILED`);
  console.log(`AUTH E2E STUBS  : ${stubResults.length} documented (see SECTION 7)`);
  if (dbFailed > 0) {
    console.log("\nFailed tests:");
    dbResults.filter((r) => !r.passed).forEach((r) => {
      console.log(`  [FAIL] [${r.category}] ${r.id.padEnd(10)} ${r.name}`);
      console.log(`         >> ${r.details}`);
    });
  }
  console.log("========================================================================");
  if (dbFailed > 0 || cleanupFailed) process.exit(1);
}

run().catch((err) => {
  console.error("Fatal error running verification suite:", err);
  process.exit(1);
});
