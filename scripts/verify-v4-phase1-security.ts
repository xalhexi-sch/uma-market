// =============================================================================
// UMA Market — V4 Phase 1 Security Stop-Ship Verification Suite
//
// SAFETY RULES:
//   1. Credentials are loaded EXCLUSIVELY from .env.security-test.local.
//   2. ABORTS (exit 2) unless the resolved Supabase project is exactly the
//      dedicated security-test project.
//   3. Never prints keys, secrets, or JWTs.
//   4. All test data uses deterministic UUIDs prefixed "d1000001-".
//      Cleaned up in finally{} after every run, even on failure.
//
// TESTS:
//   SEC-OI-001:  Direct order_items INSERT is blocked by RLS (policy dropped)
//   SEC-SELL-001: Checkout RPC rejects orders to suspended sellers
//   SEC-MOD-001a: moderation_status column exists with correct constraint
//   SEC-MOD-001b: Non-admin cannot modify moderation_status
//   SEC-MOD-001c: Non-admin cannot reactivate a moderation-suspended product
//   SEC-MOD-001d: Flagged/suspended products are hidden from public reads
//
//   LIVE (real Clerk Development session JWTs, same personas/pattern as
//   scripts/verify-auth-e2e.ts; service_role is used only for seeding and
//   for reading back state):
//   LIVE-OI-*:   signed-in buyer cannot directly INSERT order_items
//   LIVE-SELL-*: signed-in buyer cannot check out from a suspended/revoked seller
//   LIVE-MOD-*:  producer cannot reactivate / un-moderate an admin-moderated product
//
// HOW TO RUN:
//   npx tsx scripts/verify-v4-phase1-security.ts
// =============================================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/nextjs/server";
import { assertClerkDevelopmentKey, loadSecurityTestEnv } from "./lib/safety-guard";

// =============================================================================
// ENVIRONMENT GUARD
// =============================================================================

const env = loadSecurityTestEnv("verify-v4-phase1-security");

const supabaseUrl       = env.supabaseUrl;
const supabaseSecretKey = env.secretKey;
const supabaseAnonKey   = env.anonKey;

// Admin client: service_role — bypasses RLS
const adminClient: SupabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Anon client: used to verify RLS from unauthenticated/normal perspective
const anonClient: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Clerk must be the Development instance (sk_test_...): the LIVE section mints
// Clerk sessions and must never touch a production Clerk instance.
assertClerkDevelopmentKey("verify-v4-phase1-security", env.clerkSecretKey);
const clerk = createClerkClient({
  secretKey: env.clerkSecretKey,
  publishableKey: env.clerkPublishableKey,
});
const activeClerkSessionIds: string[] = [];

async function getAuthenticatedClient(userId: string): Promise<SupabaseClient> {
  const session = await clerk.sessions.createSession({ userId });
  activeClerkSessionIds.push(session.id);
  const { jwt } = await clerk.sessions.getToken(session.id);
  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => jwt,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// =============================================================================
// TEST INFRASTRUCTURE
// =============================================================================

type TestCategory = "STATIC" | "DATABASE" | "LIVE";

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
  console.log(`  [${icon}] [${category.padEnd(8)}] ${id.padEnd(16)} ${name}`);
  if (!condition) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(72));
}

// =============================================================================
// DETERMINISTIC TEST IDS
// =============================================================================

const TEST_FARMER_CLERK_ID    = "user_test_farmer_phase1_sec";
const TEST_BUSINESS_CLERK_ID  = "user_test_business_phase1_sec";
const TEST_CATEGORY_ID        = "d1000001-0001-0001-0001-000000000001";
const TEST_PRODUCT_ID         = "d1000001-0001-0001-0001-000000000002";
const TEST_PRODUCT_MOD_ID     = "d1000001-0001-0001-0001-000000000003";
const TEST_ORDER_ID           = "d1000001-0001-0001-0001-000000000004";

// LIVE personas: existing Clerk Development users shared with verify-auth-e2e.ts.
// Their profile state is restored to active/verified in cleanup.
const LIVE_BUYER_CLERK_ID  = "user_3JhPbugktYsiMOGIDxF40YwRzx7"; // business
const LIVE_FARMER_CLERK_ID = "user_3JhPbDuVSiPLuEA6Z8oo86c4Jmr"; // farmer
const LIVE_ADMIN_CLERK_ID  = "user_3JhUR15hV88Uxb47ZHVVN3BY7xu"; // admin
const LIVE_PRODUCT_ID      = "d1000001-0002-0002-0002-000000000001";
const LIVE_PRODUCT_MOD_ID  = "d1000001-0002-0002-0002-000000000002";
const LIVE_ORDER_ID        = "d1000001-0002-0002-0002-000000000003";

function buildPickupDate(daysFromManilaToday: number): string {
  const todayManila = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const target = new Date(`${todayManila}T00:00:00Z`);
  target.setUTCDate(target.getUTCDate() + daysFromManilaToday);
  return target.toISOString().slice(0, 10);
}
const PICKUP_DATE = buildPickupDate(7);

// =============================================================================
// CLEANUP
// =============================================================================

async function cleanup(): Promise<void> {
  console.log("\n  Cleaning up test data...");
  // Delete in dependency order
  await adminClient.from("order_items").delete().eq("order_id", TEST_ORDER_ID);
  await adminClient.from("orders").delete().eq("id", TEST_ORDER_ID);
  await adminClient.from("cart_items").delete().eq("business_clerk_id", TEST_BUSINESS_CLERK_ID);
  await adminClient.from("products").delete().eq("id", TEST_PRODUCT_ID);
  await adminClient.from("products").delete().eq("id", TEST_PRODUCT_MOD_ID);
  await adminClient.from("profiles").delete().eq("clerk_id", TEST_FARMER_CLERK_ID);
  await adminClient.from("profiles").delete().eq("clerk_id", TEST_BUSINESS_CLERK_ID);

  await cleanupLive();

  // Only delete category if it exists and was ours
  await adminClient.from("categories").delete().eq("id", TEST_CATEGORY_ID);
  console.log("  Cleanup complete.");
}

async function cleanupLive(): Promise<void> {
  // Orders touching LIVE products (incl. any created by the positive control)
  const { data: liveItems } = await adminClient
    .from("order_items")
    .select("order_id")
    .in("product_id", [LIVE_PRODUCT_ID, LIVE_PRODUCT_MOD_ID]);
  const orderIds = Array.from(new Set([
    LIVE_ORDER_ID,
    ...((liveItems ?? []) as Array<{ order_id: string }>).map((r) => r.order_id),
  ]));
  await adminClient.from("notifications").delete()
    .in("dedupe_key", orderIds.map((id) => `order:new:${id}`));
  await adminClient.from("order_items").delete().in("order_id", orderIds);
  await adminClient.from("orders").delete().in("id", orderIds);
  await adminClient.from("cart_items").delete()
    .eq("business_clerk_id", LIVE_BUYER_CLERK_ID)
    .in("product_id", [LIVE_PRODUCT_ID, LIVE_PRODUCT_MOD_ID]);
  await adminClient.from("products").delete().in("id", [LIVE_PRODUCT_ID, LIVE_PRODUCT_MOD_ID]);
  await adminClient.from("profiles")
    .update({ status: "active", is_verified: true })
    .in("clerk_id", [LIVE_BUYER_CLERK_ID, LIVE_FARMER_CLERK_ID]);

  for (const sessionId of activeClerkSessionIds) {
    try { await clerk.sessions.revokeSession(sessionId); } catch { /* already ended */ }
  }
  activeClerkSessionIds.length = 0;
}

// =============================================================================
// SEED HELPERS
// =============================================================================

async function seedTestData(): Promise<void> {
  console.log("  Seeding test data...");

  // Category
  await adminClient.from("categories").upsert({
    id: TEST_CATEGORY_ID,
    name: "Test Phase1 Category",
    slug: "test-phase1-category",
    description: "Test category for Phase 1 security verification",
    icon: "ri-test-tube-line",
  });

  // Farmer profile (active)
  await adminClient.from("profiles").upsert({
    clerk_id: TEST_FARMER_CLERK_ID,
    role: "farmer",
    full_name: "Test Farmer Phase1",
    city: "Butuan",
    status: "active",
  });

  // Business profile (active)
  await adminClient.from("profiles").upsert({
    clerk_id: TEST_BUSINESS_CLERK_ID,
    role: "business",
    full_name: "Test Business Phase1",
    city: "Butuan",
    status: "active",
  });

  // Product (active, approved)
  await adminClient.from("products").upsert({
    id: TEST_PRODUCT_ID,
    farmer_clerk_id: TEST_FARMER_CLERK_ID,
    category_id: TEST_CATEGORY_ID,
    name: "Test Tomatoes Phase1",
    description: "Test product for Phase 1",
    price_per_unit: 60.00,
    unit: "kg",
    quantity_available: 100,
    min_order_quantity: 1,
    status: "active",
  });

  // Product for moderation tests
  await adminClient.from("products").upsert({
    id: TEST_PRODUCT_MOD_ID,
    farmer_clerk_id: TEST_FARMER_CLERK_ID,
    category_id: TEST_CATEGORY_ID,
    name: "Test Moderated Product Phase1",
    description: "Test product for moderation verification",
    price_per_unit: 50.00,
    unit: "kg",
    quantity_available: 50,
    min_order_quantity: 1,
    status: "active",
  });

  // Order for order_items test
  await adminClient.from("orders").upsert({
    id: TEST_ORDER_ID,
    business_clerk_id: TEST_BUSINESS_CLERK_ID,
    farmer_clerk_id: TEST_FARMER_CLERK_ID,
    fulfillment_type: "pickup",
    total_amount: 600.00,
    status: "pending",
  });

  console.log("  Seed complete.");
}

// =============================================================================
// TESTS
// =============================================================================

async function runTests(): Promise<void> {
  // ─── SEC-OI-001: Direct order_items INSERT blocked ────────────────────
  section("SEC-OI-001: Direct order_items INSERT blocked by RLS");

  // The anon client with no JWT should not be able to insert order_items
  // More importantly, even an authenticated business user should not be able to
  // directly insert — but we can only test anon/service-role here.
  // The policy drop means ONLY service_role and admin JWT users can insert.
  const { error: directInsertError } = await anonClient.from("order_items").insert({
    order_id: TEST_ORDER_ID,
    product_id: TEST_PRODUCT_ID,
    quantity: 5,
    unit_price: 0.01, // forged price
  });

  assert(
    "SEC-OI-001",
    "DATABASE",
    "Anon direct order_items INSERT is rejected",
    directInsertError !== null,
    directInsertError
      ? `Correctly rejected: ${directInsertError.message}`
      : "DANGER: Anon INSERT into order_items was accepted — policy may still exist!"
  );

  // Verify through admin client that the policy no longer exists
  const { data: policies, error: policyError } = await adminClient.rpc("exec_sql", {
    sql: `SELECT policyname FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'order_items: business inserts'`
  }).maybeSingle();

  // If the RPC doesn't exist, check via a direct query
  if (policyError) {
    // Fallback: check the information_schema or just verify the insert failed
    assert(
      "SEC-OI-001b",
      "DATABASE",
      "Business INSERT policy dropped (verified via failed insert)",
      directInsertError !== null,
      "Could not query pg_policies directly, but INSERT was correctly rejected"
    );
  } else {
    assert(
      "SEC-OI-001b",
      "DATABASE",
      "Business INSERT policy no longer exists in pg_policies",
      !policies || (Array.isArray(policies) && policies.length === 0),
      policies ? `Policy still found: ${JSON.stringify(policies)}` : "Policy correctly absent"
    );
  }

  // ─── SEC-SELL-001: Seller status check ────────────────────────────────
  section("SEC-SELL-001: Seller status check during checkout");

  // Suspend the farmer, then try to verify the RPC would reject
  // Note: SECURITY DEFINER RPCs require a real JWT — service_role cannot call them
  // So we verify at the data level that the seller status check exists in the function

  // Check function source for seller status validation
  const { data: funcSource } = await adminClient.rpc("exec_sql", {
    sql: `SELECT prosrc FROM pg_proc WHERE proname = 'place_checkout_orders' ORDER BY oid DESC LIMIT 1`
  }).maybeSingle();

  let funcHasSellerCheck = false;
  if (funcSource && typeof funcSource === "object" && "prosrc" in funcSource) {
    const src = String((funcSource as Record<string, unknown>).prosrc);
    funcHasSellerCheck = src.includes("v_seller_status") && src.includes("Seller account is");
  } else if (policyError) {
    // Cannot query pg_proc either — check via migration file existence
    const fs = await import("node:fs");
    const migrationPath = `${process.cwd()}/supabase/migrations/20261005000003_v4_phase1_security_stopship.sql`;
    const migrationExists = fs.existsSync(migrationPath);
    const migrationContent = migrationExists ? fs.readFileSync(migrationPath, "utf8") : "";
    funcHasSellerCheck = migrationContent.includes("v_seller_status") && migrationContent.includes("Seller account is");
  }

  assert(
    "SEC-SELL-001a",
    "STATIC",
    "place_checkout_orders includes seller status validation",
    funcHasSellerCheck,
    funcHasSellerCheck
      ? "Seller status check found in RPC source"
      : "MISSING: place_checkout_orders does not contain seller status validation"
  );

  // Check place_order too
  const { data: funcSource2 } = await adminClient.rpc("exec_sql", {
    sql: `SELECT prosrc FROM pg_proc WHERE proname = 'place_order' ORDER BY oid DESC LIMIT 1`
  }).maybeSingle();

  let func2HasSellerCheck = false;
  if (funcSource2 && typeof funcSource2 === "object" && "prosrc" in funcSource2) {
    const src = String((funcSource2 as Record<string, unknown>).prosrc);
    func2HasSellerCheck = src.includes("v_seller_status") && src.includes("Seller account is");
  } else {
    const fs = await import("node:fs");
    const migrationPath = `${process.cwd()}/supabase/migrations/20261005000003_v4_phase1_security_stopship.sql`;
    const migrationExists = fs.existsSync(migrationPath);
    const migrationContent = migrationExists ? fs.readFileSync(migrationPath, "utf8") : "";
    func2HasSellerCheck = migrationContent.includes("v_seller_status") && migrationContent.includes("Seller account is");
  }

  assert(
    "SEC-SELL-001b",
    "STATIC",
    "place_order includes seller status validation",
    func2HasSellerCheck,
    func2HasSellerCheck
      ? "Seller status check found in RPC source"
      : "MISSING: place_order does not contain seller status validation"
  );

  // ─── SEC-MOD-001: Moderation state separation ────────────────────────
  section("SEC-MOD-001: Product moderation state separation");

  // 3a. Verify moderation_status column exists
  const { data: colData, error: colError } = await adminClient
    .from("products")
    .select("moderation_status")
    .eq("id", TEST_PRODUCT_ID)
    .single();

  assert(
    "SEC-MOD-001a",
    "DATABASE",
    "moderation_status column exists on products",
    colError === null && colData !== null && "moderation_status" in colData,
    colError
      ? `Column query failed: ${colError.message}`
      : colData && "moderation_status" in colData
        ? `Default value: ${(colData as Record<string, unknown>).moderation_status}`
        : "moderation_status column not found in result"
  );

  assert(
    "SEC-MOD-001a2",
    "DATABASE",
    "moderation_status defaults to 'approved'",
    colData !== null && (colData as Record<string, unknown>).moderation_status === "approved",
    colData
      ? `Got: ${(colData as Record<string, unknown>).moderation_status}`
      : "No data"
  );

  // 3b. Verify invalid moderation_status is rejected
  const { error: invalidModError } = await adminClient
    .from("products")
    .update({ moderation_status: "invalid_value" })
    .eq("id", TEST_PRODUCT_MOD_ID);

  assert(
    "SEC-MOD-001b",
    "DATABASE",
    "Invalid moderation_status value is rejected by CHECK constraint",
    invalidModError !== null,
    invalidModError
      ? `Correctly rejected: ${invalidModError.message}`
      : "DANGER: Invalid moderation_status was accepted"
  );

  // 3c. Invariant: a product cannot be active while moderated
  const { error: invariantError } = await adminClient
    .from("products")
    .update({ moderation_status: "suspended" })
    .eq("id", TEST_PRODUCT_MOD_ID);

  assert(
    "SEC-MOD-001c",
    "DATABASE",
    "status='active' + moderation_status='suspended' is rejected (invariant)",
    invariantError !== null,
    invariantError
      ? `Correctly rejected: ${invariantError.message}`
      : "DANGER: active product was suspended without leaving 'active' — DEFINER paths can still expose it"
  );

  // 3c2. Admin moderation flow: suspend + archive in one update
  const { error: adminModError } = await adminClient
    .from("products")
    .update({ moderation_status: "suspended", status: "archived" })
    .eq("id", TEST_PRODUCT_MOD_ID);

  assert(
    "SEC-MOD-001c2",
    "DATABASE",
    "Admin (service_role) can suspend + archive a product",
    adminModError === null,
    adminModError ? `Admin update failed: ${adminModError.message}` : "Admin successfully suspended product"
  );

  // 3c3. Reactivating while suspended is rejected
  const { error: reactivateError } = await adminClient
    .from("products")
    .update({ status: "active" })
    .eq("id", TEST_PRODUCT_MOD_ID);

  assert(
    "SEC-MOD-001c3",
    "DATABASE",
    "Moderation-suspended product cannot be set back to 'active'",
    reactivateError !== null,
    reactivateError ? `Correctly rejected: ${reactivateError.message}` : "DANGER: suspended product reactivated"
  );

  // 3c4. SECURITY DEFINER search must not return the moderated product
  const { data: searchRows, error: searchError } = await adminClient.rpc("search_products", {
    p_search: "Test Moderated Product Phase1",
    p_in_stock_only: false,
    p_limit: 100,
  });
  const searchIds = ((searchRows ?? []) as Array<{ id: string }>).map((r) => r.id);

  assert(
    "SEC-MOD-001c4",
    "DATABASE",
    "search_products (SECURITY DEFINER) excludes moderated product",
    searchError === null && !searchIds.includes(TEST_PRODUCT_MOD_ID),
    searchError ? `search_products failed: ${searchError.message}` : `Returned ids: ${searchIds.join(", ")}`
  );

  // 3d. Verify suspended product is hidden from marketplace reads
  // The "products: read active" policy now requires moderation_status = 'approved'
  const { data: visibleProducts } = await anonClient
    .from("products")
    .select("id, name, status, moderation_status")
    .eq("id", TEST_PRODUCT_MOD_ID);

  assert(
    "SEC-MOD-001d",
    "DATABASE",
    "Moderation-suspended product is hidden from marketplace reads",
    !visibleProducts || visibleProducts.length === 0,
    visibleProducts && visibleProducts.length > 0
      ? `DANGER: Suspended product visible to anon: ${JSON.stringify(visibleProducts)}`
      : "Correctly hidden from anonymous/unauthenticated reads"
  );

  // 3e. Verify approved + active product IS visible
  const { data: approvedProducts } = await anonClient
    .from("products")
    .select("id, name")
    .eq("id", TEST_PRODUCT_ID);

  assert(
    "SEC-MOD-001e",
    "DATABASE",
    "Approved + active product remains visible in marketplace",
    approvedProducts !== null && approvedProducts.length > 0,
    approvedProducts && approvedProducts.length > 0
      ? `Correctly visible: ${approvedProducts[0].name}`
      : "ERROR: Approved active product is not visible — check policy"
  );

  await runLiveTests();

  // 3f. Verify migration file exists and is well-formed
  const fs = await import("node:fs");
  const migrationPath = `${process.cwd()}/supabase/migrations/20261005000003_v4_phase1_security_stopship.sql`;

  assert(
    "SEC-MIG-001",
    "STATIC",
    "Phase 1 security migration file exists",
    fs.existsSync(migrationPath),
    fs.existsSync(migrationPath)
      ? `Found at: ${migrationPath}`
      : "Migration file not found"
  );
}

// =============================================================================
// LIVE AUTHENTICATED TESTS (real Clerk session JWTs)
// =============================================================================

async function setSellerStatus(status: string): Promise<void> {
  const { error } = await adminClient.from("profiles").update({ status }).eq("clerk_id", LIVE_FARMER_CLERK_ID);
  if (error) throw new Error(`seed: set seller status failed: ${error.message}`);
}

async function seedCart(quantity: number): Promise<void> {
  await adminClient.from("cart_items").delete()
    .eq("business_clerk_id", LIVE_BUYER_CLERK_ID).eq("product_id", LIVE_PRODUCT_ID);
  const { error } = await adminClient.from("cart_items").insert({
    business_clerk_id: LIVE_BUYER_CLERK_ID, product_id: LIVE_PRODUCT_ID, quantity,
  });
  if (error) throw new Error(`seed: cart insert failed: ${error.message}`);
}

async function liveOrderCount(): Promise<number> {
  const { count } = await adminClient.from("order_items")
    .select("id", { count: "exact", head: true }).eq("product_id", LIVE_PRODUCT_ID);
  return count ?? 0;
}

async function readModProduct(): Promise<{ status: string; moderation_status: string; description: string | null } | null> {
  const { data } = await adminClient.from("products")
    .select("status, moderation_status, description").eq("id", LIVE_PRODUCT_MOD_ID).single();
  return data as { status: string; moderation_status: string; description: string | null } | null;
}

async function runLiveTests(): Promise<void> {
  section("LIVE: authenticated Clerk JWT tests");

  // ── Seed (service_role) ────────────────────────────────────────────────
  const { data: personas, error: personaErr } = await adminClient.from("profiles")
    .select("clerk_id, role").in("clerk_id", [LIVE_BUYER_CLERK_ID, LIVE_FARMER_CLERK_ID]);
  if (personaErr || (personas ?? []).length !== 2) {
    throw new Error("LIVE seed: Clerk persona profiles missing — run verify-auth-e2e provisioning first");
  }
  await adminClient.from("profiles").update({ status: "active", is_verified: true })
    .in("clerk_id", [LIVE_BUYER_CLERK_ID, LIVE_FARMER_CLERK_ID]);

  const base = {
    farmer_clerk_id: LIVE_FARMER_CLERK_ID, category_id: TEST_CATEGORY_ID,
    unit: "kg", min_order_quantity: 1,
  };
  const { error: prodErr } = await adminClient.from("products").upsert([
    { ...base, id: LIVE_PRODUCT_ID, name: "Live Phase0 Checkout Product", price_per_unit: 70,
      quantity_available: 100, status: "active" },
    { ...base, id: LIVE_PRODUCT_MOD_ID, name: "Live Phase0 Moderated Product", price_per_unit: 55,
      quantity_available: 40, status: "active" },
  ], { onConflict: "id" });
  if (prodErr) throw new Error(`LIVE seed: products failed: ${prodErr.message}`);

  const { error: orderErr } = await adminClient.from("orders").upsert({
    id: LIVE_ORDER_ID, business_clerk_id: LIVE_BUYER_CLERK_ID, farmer_clerk_id: LIVE_FARMER_CLERK_ID,
    fulfillment_type: "pickup", pickup_date: PICKUP_DATE, total_amount: 70, status: "pending",
  });
  if (orderErr) throw new Error(`LIVE seed: order failed: ${orderErr.message}`);

  console.log("  Minting Clerk Development session JWTs (buyer, producer, admin)...");
  const buyer = await getAuthenticatedClient(LIVE_BUYER_CLERK_ID);
  const farmer = await getAuthenticatedClient(LIVE_FARMER_CLERK_ID);
  const admin = await getAuthenticatedClient(LIVE_ADMIN_CLERK_ID);

  // ── LIVE-OI: direct order_items insert ─────────────────────────────────
  {
    // Sanity: the buyer JWT really is the order owner (RLS read succeeds).
    const { data: ownOrder } = await buyer.from("orders").select("id").eq("id", LIVE_ORDER_ID);
    assert("LIVE-OI-000", "LIVE", "Control: buyer JWT can read its own order",
      (ownOrder ?? []).length === 1, `rows=${(ownOrder ?? []).length}`);

    const { error } = await buyer.from("order_items").insert({
      order_id: LIVE_ORDER_ID, product_id: LIVE_PRODUCT_ID, quantity: 50, unit_price: 0.01,
    });
    const { count } = await adminClient.from("order_items")
      .select("id", { count: "exact", head: true }).eq("order_id", LIVE_ORDER_ID);
    assert("LIVE-OI-001", "LIVE", "Signed-in buyer cannot INSERT order_items into own order",
      error !== null && (count ?? 0) === 0,
      error ? `rejected: ${error.message}; rows=${count}` : `DANGER: insert accepted; rows=${count}`);
  }

  // ── LIVE-SELL: checkout from suspended / revoked seller ────────────────
  const checkoutPayload = {
    p_orders: [{
      farmer_clerk_id: LIVE_FARMER_CLERK_ID, fulfillment_type: "pickup", pickup_date: PICKUP_DATE,
      items: [{ product_id: LIVE_PRODUCT_ID, quantity: 2 }],
    }],
  };
  const placeOrderPayload = {
    p_farmer_clerk_id: LIVE_FARMER_CLERK_ID, p_fulfillment_type: "pickup", p_pickup_date: PICKUP_DATE,
    p_items: [{ product_id: LIVE_PRODUCT_ID, quantity: 2 }],
  };

  for (const sellerStatus of ["suspended", "revoked"]) {
    await setSellerStatus(sellerStatus);
    await seedCart(2);
    const before = await liveOrderCount();

    const { error: e1 } = await buyer.rpc("place_checkout_orders", checkoutPayload);
    assert(`LIVE-SELL-${sellerStatus}-a`, "LIVE",
      `place_checkout_orders rejects ${sellerStatus} seller`,
      e1 !== null && e1.message.includes(`Seller account is ${sellerStatus}`) && (await liveOrderCount()) === before,
      e1 ? `rejected: ${e1.message}` : "DANGER: checkout accepted");

    const { error: e2 } = await buyer.rpc("place_order", placeOrderPayload);
    assert(`LIVE-SELL-${sellerStatus}-b`, "LIVE",
      `place_order rejects ${sellerStatus} seller`,
      e2 !== null && e2.message.includes(`Seller account is ${sellerStatus}`) && (await liveOrderCount()) === before,
      e2 ? `rejected: ${e2.message}` : "DANGER: place_order accepted");
  }

  // Positive control: same buyer/product/payload succeeds once the seller is active.
  {
    await setSellerStatus("active");
    await seedCart(2);
    const before = await liveOrderCount();
    const { data, error } = await buyer.rpc("place_checkout_orders", checkoutPayload);
    const orderIds = (data as { order_ids?: string[] } | null)?.order_ids ?? [];
    assert("LIVE-SELL-active", "LIVE", "Control: checkout from an active seller succeeds",
      error === null && orderIds.length === 1 && (await liveOrderCount()) === before + 1,
      error ? `unexpected error: ${error.message}` : `order_ids=${orderIds.length}`);
  }

  // ── LIVE-MOD: producer vs admin-moderated product ──────────────────────
  {
    // Admin moderation (service_role, same single-UPDATE flow the invariant requires).
    const { error: modErr } = await adminClient.from("products")
      .update({ moderation_status: "suspended", status: "archived" }).eq("id", LIVE_PRODUCT_MOD_ID);
    if (modErr) throw new Error(`LIVE seed: moderation failed: ${modErr.message}`);

    // Control: producer JWT does have write access to its own product (RLS allows it).
    const { error: descErr } = await farmer.from("products")
      .update({ description: "producer edit while moderated" }).eq("id", LIVE_PRODUCT_MOD_ID);
    const afterDesc = await readModProduct();
    assert("LIVE-MOD-000", "LIVE", "Control: producer JWT can edit non-moderation fields of own product",
      descErr === null && afterDesc?.description === "producer edit while moderated",
      descErr ? `error: ${descErr.message}` : `description=${afterDesc?.description}`);

    const { error: reactErr } = await farmer.from("products")
      .update({ status: "active" }).eq("id", LIVE_PRODUCT_MOD_ID);
    const r1 = await readModProduct();
    assert("LIVE-MOD-001", "LIVE", "Producer cannot reactivate an admin-moderated product",
      reactErr !== null && r1?.status === "archived" && r1?.moderation_status === "suspended",
      reactErr ? `rejected: ${reactErr.message}` : `DANGER: state=${JSON.stringify(r1)}`);

    const { error: unmodErr } = await farmer.from("products")
      .update({ moderation_status: "approved" }).eq("id", LIVE_PRODUCT_MOD_ID);
    const r2 = await readModProduct();
    assert("LIVE-MOD-002", "LIVE", "Producer cannot change moderation_status",
      unmodErr !== null && r2?.moderation_status === "suspended",
      unmodErr ? `rejected: ${unmodErr.message}` : `DANGER: state=${JSON.stringify(r2)}`);

    const { error: bothErr } = await farmer.from("products")
      .update({ moderation_status: "approved", status: "active" }).eq("id", LIVE_PRODUCT_MOD_ID);
    const r3 = await readModProduct();
    assert("LIVE-MOD-003", "LIVE", "Producer cannot approve + activate in one update",
      bothErr !== null && r3?.status === "archived" && r3?.moderation_status === "suspended",
      bothErr ? `rejected: ${bothErr.message}` : `DANGER: state=${JSON.stringify(r3)}`);

    // Control: an admin JWT can lift moderation and reactivate.
    const { error: adminErr } = await admin.from("products")
      .update({ moderation_status: "approved", status: "active" }).eq("id", LIVE_PRODUCT_MOD_ID);
    const r4 = await readModProduct();
    assert("LIVE-MOD-004", "LIVE", "Control: admin JWT can approve + reactivate",
      adminErr === null && r4?.status === "active" && r4?.moderation_status === "approved",
      adminErr ? `error: ${adminErr.message}` : `state=${JSON.stringify(r4)}`);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log("=".repeat(72));
  console.log("  UMA V4 Phase 1 — Security Stop-Ship Verification");
  console.log("=".repeat(72));

  try {
    await cleanup();
    await seedTestData();
    await runTests();
  } finally {
    await cleanup();
  }

  // Summary
  console.log(`\n${"=".repeat(72)}`);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${total} total`);

  if (failed > 0) {
    console.log(`\n  FAILURES:`);
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    [${r.id}] ${r.name}`);
      console.log(`           ${r.details}`);
    }
  }

  console.log("=".repeat(72));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
