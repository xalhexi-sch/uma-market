// =============================================================================
// UMA Market — Authenticated E2E Hardening Verification Suite
//
// SAFETY RULES:
//   1. MUST ONLY target the dedicated security-test Supabase project.
//   2. ABORTS immediately on production database detected.
//   3. ABORTS on any unknown project URL.
//   4. Uses Clerk Development instance (thankful-terrapin-2971) with test accounts.
//   5. Never prints keys, secrets, or JWTs.
//   6. All test data uses deterministic UUIDs prefixed "e0000001-".
//      Cleaned up in finally{} after every run, even on failure.
//
// TEST SUITE: AUTH-E2E-01 through AUTH-E2E-08
//   AUTH-E2E-01  Multi-farmer checkout atomicity via place_checkout_orders
//   AUTH-E2E-02  Insufficient stock rejection + full rollback
//   AUTH-E2E-03  MOQ rejection through authenticated checkout
//   AUTH-E2E-04  Farmer update_order_status: valid + invalid transition paths
//   AUTH-E2E-05  Buyer cancelOrder: cancels pending, trigger restores stock
//   AUTH-E2E-06  Authenticated Buyer B cannot read Buyer A orders (cross-tenant RLS)
//   AUTH-E2E-07  Buyer JWT calling update_order_status raises farmer-only error
//   AUTH-E2E-08  Revoked profile blocked by assertActiveProfile (SEC-AUTH-001)
//
// HOW TO RUN:
//   npx tsx --env-file=.env.security-test.local scripts/verify-auth-e2e.ts
// =============================================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/nextjs/server";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.security-test.local") });

// =============================================================================
// ENVIRONMENT GUARD — hard abort if not pointed at security-test project
// =============================================================================

const PROD_REF          = "odnpkqjytrmciwmcehff";
const SECURITY_TEST_REF = "xckdihprwjdwutglytwu";
const SECURITY_TEST_URL = `https://${SECURITY_TEST_REF}.supabase.co`;

const supabaseUrl       = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey   = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const clerkSecretKey    = process.env.CLERK_SECRET_KEY ?? "";
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (supabaseUrl.includes(PROD_REF)) {
  console.error("================================================================");
  console.error("  SAFETY ABORT: PRODUCTION DATABASE DETECTED");
  console.error("  Mutation tests against production are STRICTLY FORBIDDEN.");
  console.error("================================================================");
  process.exit(2);
}

if (supabaseUrl !== SECURITY_TEST_URL) {
  console.error("================================================================");
  console.error("  SAFETY ABORT: UNKNOWN SUPABASE PROJECT");
  console.error(`  Expected : ${SECURITY_TEST_URL}`);
  console.error(`  Active   : ${supabaseUrl || "(not set)"}`);
  console.error("================================================================");
  process.exit(2);
}

if (!supabaseAnonKey || !supabaseSecretKey || !clerkSecretKey || !clerkPublishableKey) {
  console.error("ABORT: Missing required Supabase or Clerk environment variables");
  process.exit(1);
}

// Clerk SDK Client
const clerk = createClerkClient({
  secretKey: clerkSecretKey,
  publishableKey: clerkPublishableKey,
});

// Admin client: service_role — used for fixture setup and state verification only
const adminClient: SupabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// =============================================================================
// TEST PERSONAS & FIXTURES
// =============================================================================

const PERSONAS = {
  buyerA: {
    clerkId: "user_3JhPbugktYsiMOGIDxF40YwRzx7",
    email: "buyer.test@example.com",
    role: "business",
  },
  buyerB: {
    clerkId: "user_3JhUSSDpL2bmzswoMoNM6RzDkyn",
    email: "buyer2.test@example.com",
    role: "business",
  },
  farmerA: {
    clerkId: "user_3JhPbDuVSiPLuEA6Z8oo86c4Jmr",
    email: "farmer.test@example.com",
    role: "farmer",
  },
  farmerB: {
    clerkId: "user_3JhUSQewYXAYXR80cEFQNwGvsZs",
    email: "farmer2.test@example.com",
    role: "farmer",
  },
  admin: {
    clerkId: "user_3JhUR15hV88Uxb47ZHVVN3BY7xu",
    email: "admin.test@example.com",
    role: "admin",
  },
};

const FIXTURES = {
  vegCategorySlug: "vegetables",
  productA1:  "e0000001-0000-0000-0000-000000000201",
  productA2:  "e0000001-0000-0000-0000-000000000202",
  productB1:  "e0000001-0000-0000-0000-000000000211",
  productLow: "e0000001-0000-0000-0000-000000000221",
  productMOQ: "e0000001-0000-0000-0000-000000000222",
};

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(id: string, name: string, condition: boolean, details: string): boolean {
  results.push({ id, name, passed: condition, details });
  const icon = condition ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${id.padEnd(14)} ${name}`);
  if (!condition) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(72));
}

// Store active Clerk session IDs to revoke in finally{}
const activeClerkSessionIds: string[] = [];

async function getAuthenticatedClient(userId: string): Promise<SupabaseClient> {
  const session = await clerk.sessions.createSession({ userId });
  activeClerkSessionIds.push(session.id);
  const tokenRes = await clerk.sessions.getToken(session.id);
  const jwt = tokenRes.jwt;

  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => jwt,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getStock(productId: string): Promise<number | null> {
  const { data } = await adminClient
    .from("products")
    .select("quantity_available")
    .eq("id", productId)
    .single();
  return data?.quantity_available ?? null;
}

async function cleanupFixtures(): Promise<void> {
  const errors: string[] = [];

  // 1. Delete test orders & items created by or for test personas
  const { data: testOrders, error: ordersSelectErr } = await adminClient
    .from("orders")
    .select("id")
    .or(
      `business_clerk_id.eq.${PERSONAS.buyerA.clerkId},` +
      `business_clerk_id.eq.${PERSONAS.buyerB.clerkId}`
    );

  if (ordersSelectErr) {
    errors.push(`orders select: ${ordersSelectErr.message}`);
  } else if (testOrders && testOrders.length > 0) {
    const ids = testOrders.map((o: { id: string }) => o.id);
    const { error: itemsDelErr } = await adminClient
      .from("order_items")
      .delete()
      .in("order_id", ids);
    if (itemsDelErr) errors.push(`order_items delete: ${itemsDelErr.message}`);

    const { error: ordersDelErr } = await adminClient
      .from("orders")
      .delete()
      .in("id", ids);
    if (ordersDelErr) errors.push(`orders delete: ${ordersDelErr.message}`);
  }

  // 2. Delete test cart items
  const { error: cartDelErr } = await adminClient
    .from("cart_items")
    .delete()
    .or(
      `business_clerk_id.eq.${PERSONAS.buyerA.clerkId},` +
      `business_clerk_id.eq.${PERSONAS.buyerB.clerkId}`
    );
  if (cartDelErr) errors.push(`cart_items delete: ${cartDelErr.message}`);

  // 3. Delete deterministic test products
  const { error: productsDelErr } = await adminClient
    .from("products")
    .delete()
    .in("id", [
      FIXTURES.productA1,
      FIXTURES.productA2,
      FIXTURES.productB1,
      FIXTURES.productLow,
      FIXTURES.productMOQ,
    ]);
  if (productsDelErr) errors.push(`products delete: ${productsDelErr.message}`);

  // 4. Ensure Buyer A profile status is restored to active
  await adminClient
    .from("profiles")
    .update({ status: "active" })
    .eq("clerk_id", PERSONAS.buyerA.clerkId);

  // 5. Revoke all created Clerk sessions
  for (const sessionId of activeClerkSessionIds) {
    try {
      await clerk.sessions.revokeSession(sessionId);
    } catch {
      // Ignored if session already ended
    }
  }
  activeClerkSessionIds.length = 0;

  if (errors.length > 0) {
    throw new Error(
      `cleanupFixtures failed (${errors.length} error(s)):\n` +
      errors.map((e) => `  - ${e}`).join("\n")
    );
  }
}

async function provisionFixtures(): Promise<boolean> {
  // Resolve category
  const { data: cat, error: catErr } = await adminClient
    .from("categories")
    .select("id")
    .eq("slug", FIXTURES.vegCategorySlug)
    .single();

  if (catErr || !cat) {
    console.error(`  Category '${FIXTURES.vegCategorySlug}' not found.`);
    return false;
  }
  const categoryId = cat.id as string;

  // Ensure test profiles are active in DB
  const { error: profErr } = await adminClient.from("profiles").upsert([
    {
      clerk_id: PERSONAS.farmerA.clerkId,
      role: "farmer",
      full_name: "Test Producer Alpha",
      business_name: "Alpha Organic Farm",
      city: "Butuan",
      status: "active",
      is_verified: true,
    },
    {
      clerk_id: PERSONAS.farmerB.clerkId,
      role: "farmer",
      full_name: "Test Producer Beta",
      business_name: "Beta High-Yield Farm",
      city: "Butuan",
      status: "active",
      is_verified: true,
    },
    {
      clerk_id: PERSONAS.buyerA.clerkId,
      role: "business",
      full_name: "Test Kitchen Buyer Alpha",
      business_name: "Alpha Commercial Bistro",
      city: "Butuan",
      status: "active",
      is_verified: true,
    },
    {
      clerk_id: PERSONAS.buyerB.clerkId,
      role: "business",
      full_name: "Test Buyer Beta",
      business_name: "Beta Restaurant Group",
      city: "Butuan",
      status: "active",
      is_verified: true,
    },
  ], { onConflict: "clerk_id" });

  if (profErr) {
    console.error("  Profile upsert failed:", profErr.message);
    return false;
  }

  // Upsert deterministic test products
  const { error: prodErr } = await adminClient.from("products").upsert([
    {
      id: FIXTURES.productA1,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      category_id: categoryId,
      name: "E2E Test Kangkong Farmer A",
      price_per_unit: 50,
      unit: "kg",
      quantity_available: 50,
      min_order_quantity: 5,
      status: "active",
    },
    {
      id: FIXTURES.productA2,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      category_id: categoryId,
      name: "E2E Test Sitaw Farmer A",
      price_per_unit: 80,
      unit: "kg",
      quantity_available: 30,
      min_order_quantity: 5,
      status: "active",
    },
    {
      id: FIXTURES.productB1,
      farmer_clerk_id: PERSONAS.farmerB.clerkId,
      category_id: categoryId,
      name: "E2E Test Ampalaya Farmer B",
      price_per_unit: 90,
      unit: "kg",
      quantity_available: 100,
      min_order_quantity: 5,
      status: "active",
    },
    {
      id: FIXTURES.productLow,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      category_id: categoryId,
      name: "E2E Test LowStock Farmer A",
      price_per_unit: 40,
      unit: "kg",
      quantity_available: 5,
      min_order_quantity: 1,
      status: "active",
    },
    {
      id: FIXTURES.productMOQ,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      category_id: categoryId,
      name: "E2E Test HighMOQ Farmer A",
      price_per_unit: 120,
      unit: "kg",
      quantity_available: 200,
      min_order_quantity: 10,
      status: "active",
    },
  ], { onConflict: "id" });

  if (prodErr) {
    console.error("  Product upsert failed:", prodErr.message);
    return false;
  }

  return true;
}

// =============================================================================
// TEST SUITE: AUTH-E2E-01 through AUTH-E2E-08
// =============================================================================

async function runAuthE2ETests(): Promise<void> {
  // Initialize authenticated clients
  console.log("  Minting authentic RS256 JWTs via Clerk Development...");
  const buyerAClient = await getAuthenticatedClient(PERSONAS.buyerA.clerkId);
  const buyerBClient = await getAuthenticatedClient(PERSONAS.buyerB.clerkId);
  const farmerAClient = await getAuthenticatedClient(PERSONAS.farmerA.clerkId);
  console.log("  Authenticated clients ready (Buyer A, Buyer B, Farmer A)");

  // ---------------------------------------------------------------------------
  // AUTH-E2E-01: Multi-farmer checkout atomicity via place_checkout_orders
  // ---------------------------------------------------------------------------
  section("AUTH-E2E-01 — Multi-Farmer Checkout Atomicity");
  {
    // Pre-populate cart items for Buyer A
    await buyerAClient.from("cart_items").upsert([
      { business_clerk_id: PERSONAS.buyerA.clerkId, product_id: FIXTURES.productA1, quantity: 5 },
      { business_clerk_id: PERSONAS.buyerA.clerkId, product_id: FIXTURES.productB1, quantity: 5 },
    ]);

    const initialStockA = await getStock(FIXTURES.productA1);
    const initialStockB = await getStock(FIXTURES.productB1);

    const { data, error } = await buyerAClient.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA.clerkId,
          fulfillment_type: "pickup",
          items: [{ product_id: FIXTURES.productA1, quantity: 5 }],
        },
        {
          farmer_clerk_id: PERSONAS.farmerB.clerkId,
          fulfillment_type: "pickup",
          items: [{ product_id: FIXTURES.productB1, quantity: 5 }],
        },
      ],
    });

    const orderIds = (data as { order_ids?: string[] })?.order_ids ?? [];
    const stockAfterA = await getStock(FIXTURES.productA1);
    const stockAfterB = await getStock(FIXTURES.productB1);

    const { data: cartRemaining } = await buyerAClient
      .from("cart_items")
      .select("id")
      .in("product_id", [FIXTURES.productA1, FIXTURES.productB1]);

    assert(
      "AUTH-E2E-01",
      "Multi-farmer checkout atomicity via place_checkout_orders",
      !error && orderIds.length === 2 &&
      stockAfterA === (initialStockA ?? 0) - 5 &&
      stockAfterB === (initialStockB ?? 0) - 5 &&
      (cartRemaining?.length ?? 0) === 0,
      error ? `RPC error: ${error.message}` : `Created 2 orders (${orderIds.join(", ")}), stock decremented, cart cleared`
    );
  }

  // ---------------------------------------------------------------------------
  // AUTH-E2E-02: Insufficient stock rejection + full rollback
  // ---------------------------------------------------------------------------
  section("AUTH-E2E-02 — Insufficient Stock Rejection & Full Rollback");
  {
    // Satisfy E2E-005 cart pre-validation gate
    await buyerAClient.from("cart_items").upsert([
      { business_clerk_id: PERSONAS.buyerA.clerkId, product_id: FIXTURES.productA1, quantity: 5 },
      { business_clerk_id: PERSONAS.buyerA.clerkId, product_id: FIXTURES.productB1, quantity: 9999 },
    ]);

    const initialStockA = await getStock(FIXTURES.productA1);
    const initialStockB = await getStock(FIXTURES.productB1);

    // Order group 1 is valid (5 units of A1), Order group 2 requests 9999 units of B1 (exceeds 95 available)
    const { error } = await buyerAClient.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA.clerkId,
          fulfillment_type: "pickup",
          items: [{ product_id: FIXTURES.productA1, quantity: 5 }],
        },
        {
          farmer_clerk_id: PERSONAS.farmerB.clerkId,
          fulfillment_type: "pickup",
          items: [{ product_id: FIXTURES.productB1, quantity: 9999 }],
        },
      ],
    });

    const stockAfterA = await getStock(FIXTURES.productA1);
    const stockAfterB = await getStock(FIXTURES.productB1);

    assert(
      "AUTH-E2E-02",
      "Insufficient stock: RPC rejects and rolls back completely",
      error !== null &&
      error.message.includes("Insufficient stock") &&
      stockAfterA === initialStockA &&
      stockAfterB === initialStockB,
      error ? `Cleanly rejected: "${error.message}" | Stock unchanged (A1=${stockAfterA}, B1=${stockAfterB})` : "UNEXPECTED: Oversell accepted!"
    );
  }

  // ---------------------------------------------------------------------------
  // AUTH-E2E-03: MOQ rejection through authenticated checkout
  // ---------------------------------------------------------------------------
  section("AUTH-E2E-03 — Minimum Order Quantity (MOQ) Rejection");
  {
    // Satisfy E2E-005 cart pre-validation gate
    await buyerAClient.from("cart_items").upsert([
      { business_clerk_id: PERSONAS.buyerA.clerkId, product_id: FIXTURES.productMOQ, quantity: 2 },
    ]);

    const initialStock = await getStock(FIXTURES.productMOQ);

    // productMOQ has min_order_quantity = 10; Buyer requests 2
    const { error } = await buyerAClient.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA.clerkId,
          fulfillment_type: "pickup",
          items: [{ product_id: FIXTURES.productMOQ, quantity: 2 }],
        },
      ],
    });

    const stockAfter = await getStock(FIXTURES.productMOQ);

    assert(
      "AUTH-E2E-03",
      "MOQ rejection: RPC rejects qty < min_order_quantity",
      error !== null &&
      error.message.includes("Minimum order") &&
      stockAfter === initialStock,
      error ? `Rejected: "${error.message}" | Stock unchanged (${stockAfter})` : "UNEXPECTED: Under-MOQ order accepted!"
    );
  }

  // ---------------------------------------------------------------------------
  // AUTH-E2E-04: Farmer update_order_status: valid + invalid transition paths
  // ---------------------------------------------------------------------------
  section("AUTH-E2E-04 — Farmer Order Status State Machine Transitions");
  {
    // Create a pending order for Farmer A
    const { data: order1 } = await adminClient.from("orders").insert({
      business_clerk_id: PERSONAS.buyerA.clerkId,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      fulfillment_type: "pickup",
      total_amount: 100,
      status: "pending",
    }).select("id").single();

    let validPathPassed = false;
    let invalidJumpBlocked = false;

    if (order1) {
      // Valid sequential transition: pending → accepted → preparing → ready → completed
      const { error: e1 } = await farmerAClient.rpc("update_order_status", { p_order_id: order1.id, p_new_status: "accepted" });
      const { error: e2 } = await farmerAClient.rpc("update_order_status", { p_order_id: order1.id, p_new_status: "preparing" });
      const { error: e3 } = await farmerAClient.rpc("update_order_status", { p_order_id: order1.id, p_new_status: "ready" });
      const { error: e4 } = await farmerAClient.rpc("update_order_status", { p_order_id: order1.id, p_new_status: "completed" });

      const { data: finalOrder } = await adminClient.from("orders").select("status").eq("id", order1.id).single();
      validPathPassed = !e1 && !e2 && !e3 && !e4 && finalOrder?.status === "completed";
    }

    // Invalid jump transition: pending → completed directly
    const { data: order2 } = await adminClient.from("orders").insert({
      business_clerk_id: PERSONAS.buyerA.clerkId,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      fulfillment_type: "pickup",
      total_amount: 100,
      status: "pending",
    }).select("id").single();

    if (order2) {
      const { error: jumpErr } = await farmerAClient.rpc("update_order_status", {
        p_order_id: order2.id,
        p_new_status: "completed",
      });

      const { data: order2Check } = await adminClient.from("orders").select("status").eq("id", order2.id).single();
      invalidJumpBlocked = jumpErr !== null && order2Check?.status === "pending";
    }

    assert(
      "AUTH-E2E-04",
      "Farmer update_order_status: valid + invalid transition paths",
      validPathPassed && invalidJumpBlocked,
      `Valid path completed: ${validPathPassed} | Invalid pending→completed blocked: ${invalidJumpBlocked}`
    );
  }

  // ---------------------------------------------------------------------------
  // AUTH-E2E-05: Buyer cancelOrder + trigger stock restoration
  // ---------------------------------------------------------------------------
  section("AUTH-E2E-05 — Buyer Cancellation & Trigger Stock Restoration");
  {
    const initialStock = await getStock(FIXTURES.productA2);
    const orderQty = 6;

    // Simulate order placement: stock decremented
    await adminClient.from("products").update({
      quantity_available: (initialStock ?? 0) - orderQty,
    }).eq("id", FIXTURES.productA2);

    const { data: cancelTestOrder } = await adminClient.from("orders").insert({
      business_clerk_id: PERSONAS.buyerA.clerkId,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      fulfillment_type: "pickup",
      total_amount: orderQty * 80,
      status: "pending",
    }).select("id").single();

    if (cancelTestOrder) {
      await adminClient.from("order_items").insert({
        order_id: cancelTestOrder.id,
        product_id: FIXTURES.productA2,
        quantity: orderQty,
        unit_price: 80,
        product_name: "E2E Test Sitaw Farmer A",
        unit: "kg",
      });

      // Buyer A executes cancellation using authenticated client (mimics cancelOrder Server Action)
      const { error: cancelErr } = await buyerAClient
        .from("orders")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: "Cancelled by buyer",
        })
        .eq("id", cancelTestOrder.id)
        .eq("business_clerk_id", PERSONAS.buyerA.clerkId)
        .eq("status", "pending");

      const stockAfterCancel = await getStock(FIXTURES.productA2);
      const { data: orderStatus } = await adminClient.from("orders").select("status").eq("id", cancelTestOrder.id).single();

      assert(
        "AUTH-E2E-05",
        "Buyer cancelOrder: cancels pending, trigger restores stock",
        !cancelErr &&
        orderStatus?.status === "cancelled" &&
        stockAfterCancel === initialStock,
        cancelErr ? `Error: ${cancelErr.message}` : `Status cancelled, stock restored from ${(initialStock ?? 0) - orderQty} to ${stockAfterCancel}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // AUTH-E2E-06: Authenticated Buyer B cannot read Buyer A orders (cross-tenant RLS)
  // ---------------------------------------------------------------------------
  section("AUTH-E2E-06 — Cross-Tenant Isolation (Buyer B vs Buyer A)");
  {
    const { data: buyerAOrder } = await adminClient.from("orders").insert({
      business_clerk_id: PERSONAS.buyerA.clerkId,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      fulfillment_type: "pickup",
      total_amount: 250,
      status: "pending",
    }).select("id").single();

    if (buyerAOrder) {
      // Buyer B attempts to read Buyer A's order with real Buyer B JWT
      const { data: crossTenantRead } = await buyerBClient
        .from("orders")
        .select("id, total_amount, business_clerk_id")
        .eq("id", buyerAOrder.id);

      // Sanity check with admin client
      const { data: adminRead } = await adminClient
        .from("orders")
        .select("id, business_clerk_id")
        .eq("id", buyerAOrder.id)
        .single();

      assert(
        "AUTH-E2E-06",
        "Authenticated Buyer B cannot read Buyer A orders (cross-tenant RLS)",
        (!crossTenantRead || crossTenantRead.length === 0) &&
        adminRead !== null && adminRead.business_clerk_id === PERSONAS.buyerA.clerkId,
        crossTenantRead?.length ? `SECURITY LEAK: Buyer B read ${crossTenantRead.length} order(s)` : "RLS Enforced: 0 rows returned to Buyer B"
      );
    }
  }

  // ---------------------------------------------------------------------------
  // AUTH-E2E-07: Buyer JWT calling update_order_status raises farmer-only error
  // ---------------------------------------------------------------------------
  section("AUTH-E2E-07 — Role Authorization Gate on update_order_status");
  {
    const { data: testOrder } = await adminClient.from("orders").insert({
      business_clerk_id: PERSONAS.buyerA.clerkId,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      fulfillment_type: "pickup",
      total_amount: 150,
      status: "pending",
    }).select("id").single();

    if (testOrder) {
      // Buyer A client attempts to call farmer-only RPC
      const { error } = await buyerAClient.rpc("update_order_status", {
        p_order_id: testOrder.id,
        p_new_status: "accepted",
      });

      assert(
        "AUTH-E2E-07",
        "Buyer JWT calling update_order_status raises farmer-only error",
        error !== null && error.message.includes("Only farmers can update order status"),
        error ? `Authorization gate enforced: "${error.message}"` : "SECURITY VIOLATION: Buyer was able to update order status!"
      );
    }
  }

  // ---------------------------------------------------------------------------
  // AUTH-E2E-08: Revoked profile blocked by assertActiveProfile (SEC-AUTH-001)
  // ---------------------------------------------------------------------------
  section("AUTH-E2E-08 — Revoked Profile Access Prevention (SEC-AUTH-001)");
  {
    // Temporarily set Buyer A profile to 'revoked'
    await adminClient
      .from("profiles")
      .update({ status: "revoked" })
      .eq("clerk_id", PERSONAS.buyerA.clerkId);

    // Attempt checkout while revoked
    const { error: checkoutErr } = await buyerAClient.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA.clerkId,
          fulfillment_type: "pickup",
          items: [{ product_id: FIXTURES.productA1, quantity: 5 }],
        },
      ],
    });

    // Check profile status in DB
    const { data: revokedProfile } = await adminClient
      .from("profiles")
      .select("status")
      .eq("clerk_id", PERSONAS.buyerA.clerkId)
      .single();

    // Restore Buyer A profile to active immediately
    await adminClient
      .from("profiles")
      .update({ status: "active" })
      .eq("clerk_id", PERSONAS.buyerA.clerkId);

    assert(
      "AUTH-E2E-08",
      "Revoked profile blocked by assertActiveProfile before checkout (SEC-AUTH-001)",
      checkoutErr !== null &&
      (checkoutErr.message.includes("revoked") ||
       checkoutErr.message.includes("active") ||
       checkoutErr.message.includes("denied") ||
       checkoutErr.message.includes("not available")) &&
      revokedProfile?.status === "revoked",
      checkoutErr ? `Blocked: "${checkoutErr.message}"` : "SECURITY VIOLATION: Revoked account checkout accepted!"
    );
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function run(): Promise<void> {
  console.log("========================================================================");
  console.log("UMA Market — Authenticated E2E Security Hardening Suite");
  console.log(`Target DB : ${SECURITY_TEST_URL}`);
  console.log(`Clerk Dev : thankful-terrapin-2971.clerk.accounts.dev`);
  console.log(`Date      : ${new Date().toISOString()}`);
  console.log("========================================================================");

  let fixturesOk = false;
  let cleanupFailed = false;

  try {
    console.log("\n  [Pre-run] Removing stale test fixtures...");
    await cleanupFixtures();
    console.log("  [Pre-run] Stale fixture cleanup OK");

    fixturesOk = await provisionFixtures();
    console.log(fixturesOk ? "  Fixtures provisioned OK" : "  Provisioning FAILED");
  } catch (e) {
    console.error("  Fatal fixture setup error:", e);
  }

  if (fixturesOk) {
    try {
      await runAuthE2ETests();
    } finally {
      section("Fixture Cleanup & Session Revocation");
      try {
        await cleanupFixtures();
        console.log("  Cleanup complete — all test data removed, all Clerk sessions revoked");
      } catch (e) {
        cleanupFailed = true;
        console.error("  Cleanup FAILED:", e);
      }
    }
  }

  console.log("\n========================================================================");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`AUTHENTICATED E2E : ${passed}/${results.length} PASSED | ${failed} FAILED`);
  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  [FAIL] ${r.id.padEnd(14)} ${r.name}`);
      console.log(`         >> ${r.details}`);
    });
  }
  console.log("========================================================================");

  if (failed > 0 || cleanupFailed || !fixturesOk) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal error running authenticated E2E verification suite:", err);
  process.exit(1);
});
