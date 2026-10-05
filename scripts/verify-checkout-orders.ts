// =============================================================================
// UMA Market — Checkout / Order / Inventory Hardening Verification Suite
//
// SAFETY RULES:
//   1. Credentials are loaded EXCLUSIVELY from .env.security-test.local.
//      .env.local points at production and is never read by this script.
//   2. ABORTS (exit 2) unless the resolved Supabase project is exactly the
//      dedicated security-test project.
//   3. ABORTS on production or on any unknown project URL.
//   4. Never prints keys, secrets, or JWTs.
//   5. All test data uses deterministic UUIDs prefixed "d0000001-".
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
//
// [COVERAGE GAP]  Authenticated end-to-end behaviour this script CANNOT honestly
//                 assert with a service_role key. Reported as NOT COVERED with
//                 ZERO assertions — never counted as a passing test. The browser
//                 regression suite under tests/browser/ covers the checkout-race
//                 and session-revocation behaviours:
//                   tests/browser/e2e-005-checkout-race.spec.ts
//                   tests/browser/sec-auth-001-session-revocation.spec.ts
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
// These behaviours are therefore NOT asserted by this script:
//   Multi-farmer checkout atomicity (place_checkout_orders)
//   Insufficient stock rejection + full rollback
//   MOQ rejection through authenticated checkout
//   Farmer update_order_status: valid + invalid paths
//   Buyer cancelOrder Server Action + trigger stock restoration
//   Authenticated Buyer B vs Buyer A cross-tenant RLS
//   Buyer JWT calling update_order_status (farmer-only guard)
//   Revoked profile blocked by assertActiveProfile (SEC-AUTH-001)
//
// HOW TO RUN:
//   npx tsx scripts/verify-checkout-orders.ts
// =============================================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { loadSecurityTestEnv, PROD_SUPABASE_REF, SECURITY_TEST_SUPABASE_URL } from "./lib/safety-guard";

// =============================================================================
// ENVIRONMENT GUARD — shared, fail-closed, security-test project only.
// =============================================================================

const env = loadSecurityTestEnv("verify-checkout-orders");

const supabaseUrl       = env.supabaseUrl;
const supabaseAnonKey   = env.anonKey;
const supabaseSecretKey = env.secretKey;

// Admin client: service_role — bypasses RLS, but NOT auth.jwt() in SECURITY DEFINER functions
const adminClient: SupabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// =============================================================================
// TEST INFRASTRUCTURE
// =============================================================================

type TestCategory = "STATIC" | "DATABASE";

interface TestResult {
  id: string;
  category: TestCategory;
  name: string;
  passed: boolean;
  details: string;
}

interface CoverageGap {
  id: string;
  name: string;
  reason: string;
}

const results: TestResult[] = [];
const coverageGaps: CoverageGap[] = [];

function assert(
  id: string,
  category: TestCategory,
  name: string,
  condition: boolean,
  details: string,
): boolean {
  results.push({ id, category, name, passed: condition, details });
  const icon = condition ? "PASS" : "FAIL";
  console.log(`  [${icon}] [${category.padEnd(8)}] ${id.padEnd(12)} ${name}`);
  if (!condition) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string, note?: string): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  if (note) console.log(`  NOTE: ${note}`);
  console.log("=".repeat(72));
}

/**
 * Records an authenticated behaviour this script cannot assert.
 *
 * Deliberately NOT pushed into `results`: a coverage gap is not a passing test,
 * so it must never contribute to the PASSED count or mask an assertion failure.
 */
function coverageGap(id: string, name: string, reason: string): void {
  coverageGaps.push({ id, name, reason });
  console.log(`  [GAP ] [NOT COVERED] ${id.padEnd(12)} ${name}`);
  console.log(`           Requires: ${reason}`);
}

// =============================================================================
// FIXTURES
// =============================================================================

const T = {
  vegCategorySlug: "vegetables",
  farmerA_id: "d0000001-0000-0000-0000-000000000001",
  farmerB_id: "d0000001-0000-0000-0000-000000000002",
  buyerA_id:  "d0000001-0000-0000-0000-000000000101",
  buyerB_id:  "d0000001-0000-0000-0000-000000000102",
  productA1:  "d0000001-0000-0000-0000-000000000201",
  productA2:  "d0000001-0000-0000-0000-000000000202",
  productB1:  "d0000001-0000-0000-0000-000000000211",
  productLow: "d0000001-0000-0000-0000-000000000221",
  productMOQ: "d0000001-0000-0000-0000-000000000222",
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
      "\nTo recover, reset the security-test database manually:\n" +
      "  npx supabase db query --linked -f scripts/reset-test-database.sql\n" +
      "  (see docs/security/SECURITY-TEST-ENVIRONMENT.md section 8 — SECURITY-TEST DATABASE ONLY)"
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
    !supabaseUrl.includes(PROD_SUPABASE_REF), `URL must not contain '${PROD_SUPABASE_REF}'`);
  assert("S-02", "STATIC", "Active URL exactly matches security-test project",
    supabaseUrl === SECURITY_TEST_SUPABASE_URL, `URL = ${SECURITY_TEST_SUPABASE_URL}`);

  // Real assertion: this script's own source must never contain a credential value
  // and must never load the production env file. Only a real import statement or
  // a quoted path is matched, so header prose does not produce a false failure.
  const selfSource = fs.readFileSync(path.join(process.cwd(), "scripts/verify-checkout-orders.ts"), "utf-8");
  const leaksSecretValue =
    selfSource.includes(supabaseSecretKey) || selfSource.includes(supabaseAnonKey);
  const loadsDotEnvPackage = /from\s+["'`]dotenv["'`]/i.test(selfSource);
  const loadsProductionEnvFile = /["'`]\.env\.local["'`]/.test(selfSource);
  assert("S-03", "STATIC", "No credential value is hard-coded and the production env file is never loaded",
    !leaksSecretValue && !loadsDotEnvPackage && !loadsProductionEnvFile,
    leaksSecretValue
      ? "FAIL: a live credential value appears verbatim in scripts/verify-checkout-orders.ts"
      : loadsDotEnvPackage
        ? "FAIL: scripts/verify-checkout-orders.ts imports the legacy env loader package"
        : loadsProductionEnvFile
          ? "FAIL: scripts/verify-checkout-orders.ts references a quoted .env.local path"
          : "No credential literals, no env-loader import, and no .env.local path literal in the suite source");

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
    const { data: dummy, error: dummyErr } = await adminClient.from("orders").insert({
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
    } else {
      // The prerequisite insert failed, so the CHECK itself was never exercised.
      // D-06 still runs — as an explicit FAIL carrying the real reason — because
      // an assertion that silently disappears when a prerequisite is false makes
      // the suite report fewer checks than it actually attempted.
      assert("D-06", "DATABASE", "order_items: CHECK (quantity > 0) enforced",
        false,
        `CHECK NOT EXERCISED — dummy order insert failed: ${
          dummyErr ? `${dummyErr.code}: ${dummyErr.message.slice(0, 120)}` : "insert returned no row"
        }`);
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
    assert("D-08-PRE", "DATABASE", "Pre-condition: pending order created", false, oErr?.message ?? "no data");
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
    assert("D-19-PRE", "DATABASE", "Buyer A order created as pre-condition", false, oaErr?.message ?? "failed");
    return;
  }
  const { data: itemFixture, error: itemFixtureError } = await adminClient.from("order_items").insert({
    order_id: orderA.id, product_id: T.productA1, quantity: 2,
    unit_price: 50, product_name: "TEST Kangkong Farmer A", unit: "kg",
  }).select("id, order_id").single();
  if (itemFixtureError || !itemFixture) {
    throw new Error(`D-20 order-item fixture setup failed: ${itemFixtureError?.message ?? "no row returned"}`);
  }
  const { data: verifiedItemFixture, error: verifiedItemFixtureError } = await adminClient
    .from("order_items").select("id, order_id").eq("id", itemFixture.id).single();
  if (verifiedItemFixtureError || verifiedItemFixture?.order_id !== orderA.id) {
    throw new Error(`D-20 privileged fixture verification failed: ${verifiedItemFixtureError?.message ?? "order item missing or mismatched"}`);
  }

  await adminClient.from("cart_items").delete().eq("business_clerk_id", T.buyerA_id).eq("product_id", T.productA1);
  const { data: cartFixture, error: cartFixtureError } = await adminClient.from("cart_items").insert(
    { business_clerk_id: T.buyerA_id, product_id: T.productA1, quantity: 5 }
  ).select("id, business_clerk_id, product_id").single();
  if (cartFixtureError || !cartFixture) {
    throw new Error(`D-21 cart fixture setup failed: ${cartFixtureError?.message ?? "no row returned"}`);
  }
  const { data: verifiedCartFixture, error: verifiedCartFixtureError } = await adminClient
    .from("cart_items").select("id, business_clerk_id, product_id").eq("id", cartFixture.id).single();
  if (verifiedCartFixtureError || verifiedCartFixture?.business_clerk_id !== T.buyerA_id
    || verifiedCartFixture.product_id !== T.productA1) {
    throw new Error(`D-21 privileged fixture verification failed: ${verifiedCartFixtureError?.message ?? "cart item missing or mismatched"}`);
  }
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: eOrds } = await anonClient.from("orders").select("id").eq("id", orderA.id);
  assert("D-19", "DATABASE", "Anon client: orders returns 0 rows (RLS enforced)",
    !eOrds || eOrds.length === 0,
    eOrds?.length ? `SECURITY VIOLATION: ${eOrds.length} order(s) exposed` : "0 rows — RLS enforced");
  const { data: eItms, error: eItmsErr } = await anonClient.from("order_items").select("id").eq("order_id", orderA.id);
  assert("D-20", "DATABASE", "Anon client: order_items returns 0 rows (RLS enforced)",
    !eItmsErr && Array.isArray(eItms) && eItms.length === 0,
    eItmsErr ? `Anonymous query failed: ${eItmsErr.message}` : eItms?.length ? `SECURITY VIOLATION: ${eItms.length} item(s) exposed` : "0 rows — RLS enforced");
  const { data: eCart, error: eCartErr } = await anonClient.from("cart_items").select("id")
    .eq("business_clerk_id", T.buyerA_id).eq("product_id", T.productA1);
  assert("D-21", "DATABASE", "Anon client: cart_items returns 0 rows (RLS enforced)",
    !eCartErr && Array.isArray(eCart) && eCart.length === 0,
    eCartErr ? `Anonymous query failed: ${eCartErr.message}` : eCart?.length ? `SECURITY VIOLATION: ${eCart.length} cart item(s) exposed` : "0 rows — RLS enforced");
  const { data: adminRead } = await adminClient.from("orders")
    .select("id, status").eq("id", orderA.id).single();
  assert("D-22", "DATABASE", "Admin (service_role) confirms order exists (sanity check)",
    adminRead !== null && adminRead.id === orderA.id,
    adminRead ? `OK (status: ${adminRead.status})` : "Admin could not read — unexpected");
}

// =============================================================================
// SECTION 7 — AUTHENTICATED COVERAGE GAPS (zero assertions)
// =============================================================================

function runCoverageGapReport(): void {
  section(
    "SECTION 7 — Authenticated Behaviours NOT Covered Here [COVERAGE GAP]",
    "Zero assertions recorded. These are never counted as passes.",
  );
  coverageGap("GAP-01",
    "Multi-farmer checkout atomicity via place_checkout_orders",
    "Real buyer JWT + 2 farmer groups; covered by tests/browser/e2e-005-checkout-race.spec.ts");
  coverageGap("GAP-02",
    "Insufficient stock: RPC rejects and rolls back completely",
    "Real buyer JWT + qty > quantity_available → raises, 0 orders, stock unchanged");
  coverageGap("GAP-03",
    "MOQ rejection: RPC rejects qty < min_order_quantity",
    "Real buyer JWT + qty=1 vs MOQ=10 → raises MOQ error, 0 orders created");
  coverageGap("GAP-04",
    "Farmer update_order_status: valid + invalid transition paths",
    "Real farmer JWT + pending→accepted→preparing→ready→completed; pending→completed rejected");
  coverageGap("GAP-05",
    "Buyer cancelOrder Server Action: cancels pending, trigger restores stock",
    "Real buyer JWT via Server Action; stock verified via admin read after cancellation");
  coverageGap("GAP-06",
    "Authenticated Buyer B cannot read Buyer A orders (cross-tenant RLS)",
    "Real Buyer B JWT querying Buyer A order ID → 0 rows (authenticated session, not anon)");
  coverageGap("GAP-07",
    "Buyer JWT calling update_order_status raises farmer-only error",
    "Real buyer JWT + update_order_status RPC → 'Only farmers can update order status'");
  coverageGap("GAP-08",
    "Revoked profile blocked by assertActiveProfile before checkout (SEC-AUTH-001)",
    "profile.status='revoked' + buyer JWT → placeMultiFarmerCheckout returns {success:false}; " +
    "covered by tests/browser/sec-auth-001-session-revocation.spec.ts");
}

// =============================================================================
// MAIN
// =============================================================================

async function run(): Promise<void> {
  console.log("========================================================================");
  console.log("UMA Market — Checkout/Order/Inventory Hardening Verification Suite");
  console.log(`Target  : ${SECURITY_TEST_SUPABASE_URL}`);
  console.log(`Date    : ${new Date().toISOString()}`);
  console.log("========================================================================");
  console.log("\nTest categories in this run:");
  console.log("  [STATIC]     — environment + source assertions (no DB mutation)");
  console.log("  [DATABASE]   — trigger / constraint / anon-RLS via service_role");
  console.log("  [COVERAGE GAP] — authenticated behaviours not asserted here (0 assertions)");
  console.log("\nReference:");
  console.log("  docs/security/SECURITY-TEST-ENVIRONMENT.md");
  console.log("  tests/browser/e2e-005-checkout-race.spec.ts");
  console.log("  tests/browser/sec-auth-001-session-revocation.spec.ts\n");

  await runStaticChecks();
  runCoverageGapReport();

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
        console.error("  Cleanup FAILED — run the reset script against the SECURITY-TEST database only:");
        console.error("    npx supabase db query --linked -f scripts/reset-test-database.sql");
        console.error("  Error:", e);
      }
    }
  }

  console.log("\n========================================================================");
  // Every entry in `results` is a real assertion; coverage gaps are tracked
  // separately and can never inflate the PASSED count.
  const ids = results.map((r) => r.id);
  const duplicateIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (duplicateIds.length > 0) {
    console.error(`FATAL: duplicate test IDs detected: ${duplicateIds.join(", ")}`);
    process.exit(1);
  }

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`ASSERTIONS       : ${passed}/${total} PASSED | ${failed} FAILED`);
  console.log(`COVERAGE GAPS    : ${coverageGaps.length} recorded, 0 assertions (see SECTION 7)`);
  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  [FAIL] [${r.category}] ${r.id.padEnd(10)} ${r.name}`);
      console.log(`         >> ${r.details}`);
    });
  }
  console.log("========================================================================");
  if (failed > 0 || cleanupFailed || !fixturesOk) process.exit(1);
}

run().catch((err) => {
  console.error("Fatal error running verification suite:", err);
  process.exit(1);
});
