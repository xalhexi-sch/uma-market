/**
 * UMA Market V4 — Focused Live Security-Test Verification: V4 Checkout & Concurrency
 *
 * SAFETY RULES:
 *   1. Credentials loaded exclusively from .env.security-test.local.
 *   2. Aborts (exit 2) unless pointing at dedicated security-test project (xckdihprwjdwutglytwu).
 *   3. Uses Clerk Development instance key to mint authenticated test sessions.
 *   4. Deterministic UUIDs prefixed "d5000001-". Cleaned up in finally block.
 *
 * COVERS:
 *   1. OWNER can checkout their active business cart
 *   2. STAFF can checkout their active business cart
 *   3. Non-member is rejected
 *   4. SELL-only business is rejected
 *   5. Business A cannot consume Business B's cart
 *   6. Client-provided business_id cannot override authenticated active business
 *   7. Client-provided price cannot affect order total (server computes from product)
 *   8. Suspended/revoked seller is rejected (SEC-SELL-001)
 *   9. Inactive/unavailable product is rejected
 *  10. MOQ violation is rejected
 *  11. Insufficient stock is rejected
 *  12. Cart items are deleted only for the checked-out business
 *  13. order.business_id is correct
 *  14. placed_by_user_id identifies the actual Clerk user who submitted checkout
 *  15. Multiple producers create separate orders
 *  16. Decimal quantities work where valid
 *  17. CRITICAL CONCURRENCY: Two authenticated members of the same business submit
 *      checkout against the same shared cart at the same time:
 *      - exactly one succeeds
 *      - exactly one fails cleanly with CART_CONFLICT
 *      - no duplicate orders
 *      - no double stock decrement
 *      - no partial cart consumption
 *  18. RLS order read isolation: business members can read, non-members cannot
 *
 * HOW TO RUN:
 *   npx tsx scripts/verify-v4-checkout-live.ts
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/nextjs/server";
import { assertClerkDevelopmentKey, loadSecurityTestEnv } from "./lib/safety-guard";
import { mapCheckoutDatabaseError } from "../src/lib/checkout-errors";

// ── Environment Guard ────────────────────────────────────────────────────────

const env = loadSecurityTestEnv("verify-v4-checkout-live");
assertClerkDevelopmentKey("verify-v4-checkout-live", env.clerkSecretKey);

const supabaseUrl = env.supabaseUrl;
const supabaseSecretKey = env.secretKey;
const supabaseAnonKey = env.anonKey;

// Admin client: service_role for seeding and verifying state
const adminClient: SupabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Clerk Development Client
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

// ── Personas & Deterministic Fixture IDs ──────────────────────────────────────

const PERSONAS = {
  buyerA: {
    clerkId: "user_3JhPbugktYsiMOGIDxF40YwRzx7", // role: business
    role: "business",
  },
  buyerB: {
    clerkId: "user_3JhUSSDpL2bmzswoMoNM6RzDkyn", // role: business
    role: "business",
  },
  farmerA: {
    clerkId: "user_3JhPbDuVSiPLuEA6Z8oo86c4Jmr", // role: farmer
    role: "farmer",
  },
  farmerB: {
    clerkId: "user_3JhUSQewYXAYXR80cEFQNwGvsZs", // role: farmer
    role: "farmer",
  },
  suspendedFarmer: {
    clerkId: "user_d5000001_suspended_farmer",
    role: "farmer",
  },
};

const FIXTURES = {
  categoryId: "d5000001-0000-0000-0000-000000000001",

  // Products
  prodA1: "d5000001-0000-0000-0000-000000000011", // Farmer A, 150/kg, stock: 100, MOQ: 2
  prodA2: "d5000001-0000-0000-0000-000000000012", // Farmer A, 80/kg, stock: 50, MOQ: 1 (decimal test)
  prodB1: "d5000001-0000-0000-0000-000000000013", // Farmer B, 120/kg, stock: 80, MOQ: 3
  prodInactive: "d5000001-0000-0000-0000-000000000014", // Inactive product
  prodSuspended: "d5000001-0000-0000-0000-000000000015", // Suspended farmer product

  // Businesses
  businessA: "d5000001-0000-0000-0000-000000000101", // Buyer A (can_buy: true)
  businessB: "d5000001-0000-0000-0000-000000000102", // Buyer B (can_buy: true)
  businessSellOnly: "d5000001-0000-0000-0000-000000000103", // Sell-only (can_buy: false)
};

// Tomorrow's date in YYYY-MM-DD (Manila time)
const tomorrow = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() + 86400000));

// ── Test Infrastructure ──────────────────────────────────────────────────────

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
  console.log(`  [${icon}] ${id.padEnd(16)} ${name}`);
  if (!condition) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(76)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(76));
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  console.log("\n  [Cleanup] Removing test fixtures...");

  // Delete order_items & orders created by test businesses
  const { data: testOrders } = await adminClient
    .from("orders")
    .select("id")
    .in("business_id", [FIXTURES.businessA, FIXTURES.businessB, FIXTURES.businessSellOnly]);

  if (testOrders && testOrders.length > 0) {
    const orderIds = testOrders.map((o) => o.id);
    await adminClient.from("order_items").delete().in("order_id", orderIds);
    await adminClient.from("orders").delete().in("id", orderIds);
  }

  // Delete cart items for test businesses
  await adminClient.from("cart_items").delete().in("business_id", [
    FIXTURES.businessA,
    FIXTURES.businessB,
    FIXTURES.businessSellOnly,
  ]);

  // Delete memberships
  await adminClient.from("business_members").delete().in("business_id", [
    FIXTURES.businessA,
    FIXTURES.businessB,
    FIXTURES.businessSellOnly,
  ]);

  // Delete businesses
  await adminClient.from("businesses").delete().in("id", [
    FIXTURES.businessA,
    FIXTURES.businessB,
    FIXTURES.businessSellOnly,
  ]);

  // Delete test products
  await adminClient.from("products").delete().in("id", [
    FIXTURES.prodA1,
    FIXTURES.prodA2,
    FIXTURES.prodB1,
    FIXTURES.prodInactive,
    FIXTURES.prodSuspended,
  ]);

  // Delete suspended farmer profile
  await adminClient.from("profiles").delete().eq("clerk_id", PERSONAS.suspendedFarmer.clerkId);

  // Delete category
  await adminClient.from("categories").delete().eq("id", FIXTURES.categoryId);

  // Revoke Clerk sessions
  for (const sessionId of activeClerkSessionIds) {
    try {
      await clerk.sessions.revokeSession(sessionId);
    } catch {
      /* ignore */
    }
  }
  activeClerkSessionIds.length = 0;
  console.log("  [Cleanup] Finished.");
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log("  [Seed] Setting up test fixtures...");

  // Category
  const { error: catErr } = await adminClient.from("categories").upsert({
    id: FIXTURES.categoryId,
    name: "Live Checkout Test Category",
    slug: "live-checkout-test-category",
    description: "Category for V4 checkout live verification",
    icon: "ri-shopping-bag-line",
  });
  if (catErr) throw new Error(`Category seed failed: ${catErr.message}`);

  // Suspended farmer profile (must specify onConflict: 'clerk_id' because table PK is 'id')
  const { error: profErr } = await adminClient.from("profiles").upsert(
    {
      clerk_id: PERSONAS.suspendedFarmer.clerkId,
      role: "farmer",
      full_name: "Suspended Test Farmer",
      business_name: "Suspended Test Farm",
      status: "suspended",
      city: "Baguio City",
    },
    { onConflict: "clerk_id" }
  );
  if (profErr) throw new Error(`Profile seed failed: ${profErr.message}`);

  // Products
  const { error: prodErr } = await adminClient.from("products").upsert([
    {
      id: FIXTURES.prodA1,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      category_id: FIXTURES.categoryId,
      name: "Checkout Test Strawberries",
      description: "Fresh Benguet strawberries",
      price_per_unit: 150.0,
      unit: "kg",
      quantity_available: 100,
      min_order_quantity: 2,
      status: "active",
      moderation_status: "approved",
    },
    {
      id: FIXTURES.prodA2,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      category_id: FIXTURES.categoryId,
      name: "Checkout Test Mountain Carrots",
      description: "Crisp carrots supporting decimal quantities",
      price_per_unit: 80.0,
      unit: "kg",
      quantity_available: 50,
      min_order_quantity: 1,
      status: "active",
      moderation_status: "approved",
    },
    {
      id: FIXTURES.prodB1,
      farmer_clerk_id: PERSONAS.farmerB.clerkId,
      category_id: FIXTURES.categoryId,
      name: "Checkout Test Organic Kale",
      description: "Fresh kale from Farmer B",
      price_per_unit: 120.0,
      unit: "kg",
      quantity_available: 80,
      min_order_quantity: 3,
      status: "active",
      moderation_status: "approved",
    },
    {
      id: FIXTURES.prodInactive,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      category_id: FIXTURES.categoryId,
      name: "Checkout Test Inactive Cabbage",
      description: "Unavailable produce",
      price_per_unit: 50.0,
      unit: "kg",
      quantity_available: 50,
      min_order_quantity: 1,
      status: "archived",
      moderation_status: "approved",
    },
    {
      id: FIXTURES.prodSuspended,
      farmer_clerk_id: PERSONAS.suspendedFarmer.clerkId,
      category_id: FIXTURES.categoryId,
      name: "Checkout Test Suspended Farm Product",
      description: "Belongs to suspended seller",
      price_per_unit: 50.0,
      unit: "kg",
      quantity_available: 50,
      min_order_quantity: 1,
      status: "active",
      moderation_status: "approved",
    },
  ]);
  if (prodErr) throw new Error(`Products seed failed: ${prodErr.message}`);

  // Businesses
  const { error: bizErr } = await adminClient.from("businesses").upsert([
    {
      id: FIXTURES.businessA,
      name: "Live Test Cafe A",
      can_buy: true,
      can_sell: false,
      status: "active",
    },
    {
      id: FIXTURES.businessB,
      name: "Live Test Restaurant B",
      can_buy: true,
      can_sell: false,
      status: "active",
    },
    {
      id: FIXTURES.businessSellOnly,
      name: "Live Test Farm Sell Only",
      can_buy: false,
      can_sell: true,
      status: "active",
    },
  ]);
  if (bizErr) throw new Error(`Businesses seed failed: ${bizErr.message}`);

  // Memberships
  // - buyerA is OWNER of businessA
  // - buyerB is STAFF of businessA
  // - farmerB is OWNER of businessB (non-member of businessA)
  // - farmerA is OWNER of businessSellOnly
  const { error: memErr } = await adminClient.from("business_members").upsert([
    {
      business_id: FIXTURES.businessA,
      user_id: PERSONAS.buyerA.clerkId,
      role: "OWNER",
    },
    {
      business_id: FIXTURES.businessA,
      user_id: PERSONAS.buyerB.clerkId,
      role: "STAFF",
    },
    {
      business_id: FIXTURES.businessB,
      user_id: PERSONAS.farmerB.clerkId,
      role: "OWNER",
    },
    {
      business_id: FIXTURES.businessSellOnly,
      user_id: PERSONAS.farmerA.clerkId,
      role: "OWNER",
    },
  ]);
  if (memErr) throw new Error(`Business members seed failed: ${memErr.message}`);

  console.log("  [Seed] Fixtures ready.");
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`Target database: ${supabaseUrl}`);
  await cleanup();
  await seed();

  // Create authenticated Supabase clients for each persona
  const ownerAClient = await getAuthenticatedClient(PERSONAS.buyerA.clerkId);
  const staffAClient = await getAuthenticatedClient(PERSONAS.buyerB.clerkId);
  const nonMemberClient = await getAuthenticatedClient(PERSONAS.farmerB.clerkId);
  const sellOnlyClient = await getAuthenticatedClient(PERSONAS.farmerA.clerkId);

  // Helper to reset a business cart
  async function resetCart(
    businessId: string,
    items: Array<{ product_id: string; quantity: number }>,
    clerkId: string = PERSONAS.buyerA.clerkId
  ): Promise<void> {
    await adminClient.from("cart_items").delete().eq("business_id", businessId);
    if (items.length > 0) {
      const { error } = await adminClient.from("cart_items").insert(
        items.map((i) => ({
          business_id: businessId,
          business_clerk_id: clerkId,
          product_id: i.product_id,
          quantity: i.quantity,
        }))
      );
      if (error) {
        throw new Error(`resetCart insert failed: ${error.message}`);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 1. Authorization: Role & Capability Tests
  // ════════════════════════════════════════════════════════════════════════════
  section("1. Authorization: Role & Capability Tests");

  // TEST 1: Non-member is rejected
  {
    await resetCart(FIXTURES.businessA, [{ product_id: FIXTURES.prodA1, quantity: 2 }]);
    const payload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        items: [{ product_id: FIXTURES.prodA1, quantity: 2 }],
      },
    ];

    const { error } = await nonMemberClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessA,
      p_orders: payload,
    });

    const isRejected = Boolean(error && error.message.includes("Not a member of the specified business"));
    assert("AUTH-01", "Non-member caller is rejected by RPC", isRejected, error?.message ?? "Allowed unexpectedly");
  }

  // TEST 2: SELL-only business is rejected
  {
    await resetCart(FIXTURES.businessSellOnly, [{ product_id: FIXTURES.prodA1, quantity: 2 }]);
    const payload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        items: [{ product_id: FIXTURES.prodA1, quantity: 2 }],
      },
    ];

    const { error } = await sellOnlyClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessSellOnly,
      p_orders: payload,
    });

    const isRejected = Boolean(error && error.message.includes("does not have buying capability"));
    assert("AUTH-02", "SELL-only business checkout is rejected", isRejected, error?.message ?? "Allowed unexpectedly");
  }

  // TEST 3: Business A cannot consume Business B's cart
  {
    await resetCart(FIXTURES.businessB, [{ product_id: FIXTURES.prodA1, quantity: 2 }]);
    await resetCart(FIXTURES.businessA, []); // Business A has no cart items

    const payload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        items: [{ product_id: FIXTURES.prodA1, quantity: 2 }],
      },
    ];

    // Owner of Business A attempts to checkout Business A, referencing items that only exist in Business B's cart
    const { error } = await ownerAClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessA,
      p_orders: payload,
    });

    const isBlocked = Boolean(error && (error.message.includes("was not found or has already been checked out")));
    assert("AUTH-03", "Business A cannot consume Business B's cart items", isBlocked, error?.message ?? "Allowed");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. Commerce Invariants & Validation Tests
  // ════════════════════════════════════════════════════════════════════════════
  section("2. Commerce Invariants & Validation Tests");

  // TEST 4: Suspended/revoked seller is rejected (SEC-SELL-001)
  {
    await resetCart(FIXTURES.businessA, [{ product_id: FIXTURES.prodSuspended, quantity: 2 }]);
    const payload = [
      {
        farmer_clerk_id: PERSONAS.suspendedFarmer.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        items: [{ product_id: FIXTURES.prodSuspended, quantity: 2 }],
      },
    ];

    const { error } = await ownerAClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessA,
      p_orders: payload,
    });

    const isRejected = Boolean(error && error.message.includes("cannot accept orders"));
    assert("COMM-01", "Suspended seller is rejected (SEC-SELL-001)", isRejected, error?.message ?? "Allowed unexpectedly");
  }

  // TEST 5: Inactive product is rejected
  {
    await resetCart(FIXTURES.businessA, [{ product_id: FIXTURES.prodInactive, quantity: 2 }]);
    const payload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        items: [{ product_id: FIXTURES.prodInactive, quantity: 2 }],
      },
    ];

    const { error } = await ownerAClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessA,
      p_orders: payload,
    });

    const isRejected = Boolean(error && error.message.includes("is not available for ordering"));
    assert("COMM-02", "Inactive product is rejected", isRejected, error?.message ?? "Allowed unexpectedly");
  }

  // TEST 6: MOQ violation is rejected
  {
    // prodA1 has min_order_quantity = 2. Try ordering 1.
    await resetCart(FIXTURES.businessA, [{ product_id: FIXTURES.prodA1, quantity: 1 }]);
    const payload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        items: [{ product_id: FIXTURES.prodA1, quantity: 1 }],
      },
    ];

    const { error } = await ownerAClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessA,
      p_orders: payload,
    });

    const isRejected = Boolean(error && error.message.includes("Minimum order"));
    assert("COMM-03", "MOQ violation is rejected", isRejected, error?.message ?? "Allowed unexpectedly");
  }

  // TEST 7: Insufficient stock is rejected
  {
    // prodA2 has stock = 50. Try ordering 51.
    await resetCart(FIXTURES.businessA, [{ product_id: FIXTURES.prodA2, quantity: 51 }]);
    const payload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        items: [{ product_id: FIXTURES.prodA2, quantity: 51 }],
      },
    ];

    const { error } = await ownerAClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessA,
      p_orders: payload,
    });

    const isRejected = Boolean(error && error.message.includes("Insufficient stock"));
    assert("COMM-04", "Insufficient stock is rejected", isRejected, error?.message ?? "Allowed unexpectedly");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. Functional Checkout & Audit Trail
  // ════════════════════════════════════════════════════════════════════════════
  section("3. Functional Checkout & Audit Trail");

  // TEST 8: OWNER can checkout their active business cart
  {
    await resetCart(FIXTURES.businessA, [{ product_id: FIXTURES.prodA1, quantity: 3 }]);
    const initialStock = (await adminClient.from("products").select("quantity_available").eq("id", FIXTURES.prodA1).single()).data?.quantity_available;

    const payload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        notes: "Owner order test",
        items: [{ product_id: FIXTURES.prodA1, quantity: 3 }],
      },
    ];

    const { data, error } = await ownerAClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessA,
      p_orders: payload,
    });

    const orderIds = data?.order_ids as string[] | undefined;
    const ok = Boolean(!error && orderIds && orderIds.length === 1);
    assert("EXEC-01", "OWNER can place checkout for active business", ok, error?.message ?? `Created: ${orderIds?.[0]}`);

    if (ok && orderIds) {
      // Verify order record
      const { data: order } = await adminClient.from("orders").select("*").eq("id", orderIds[0]).single();
      assert("AUDIT-01", "order.business_id matches buyer business", order?.business_id === FIXTURES.businessA, `business_id=${order?.business_id}`);
      assert("AUDIT-02", "order.placed_by_user_id identifies OWNER Clerk ID", order?.placed_by_user_id === PERSONAS.buyerA.clerkId, `placed_by=${order?.placed_by_user_id}`);
      assert("STOCK-01", "Stock decremented correctly by ordered quantity", (await adminClient.from("products").select("quantity_available").eq("id", FIXTURES.prodA1).single()).data?.quantity_available === (initialStock ?? 0) - 3, "Stock decremented by 3");

      // Verify cart was cleared for businessA
      const { data: cartLeft } = await adminClient.from("cart_items").select("id").eq("business_id", FIXTURES.businessA);
      assert("CART-01", "Cart items cleared for businessA after checkout", cartLeft?.length === 0, `Remaining: ${cartLeft?.length}`);
    }
  }

  // TEST 9: STAFF can checkout their active business cart
  {
    await resetCart(FIXTURES.businessA, [{ product_id: FIXTURES.prodA1, quantity: 2 }]);
    const payload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "seller_delivery",
        delivery_address: "123 Session Road, Baguio City",
        notes: "Staff delivery test",
        items: [{ product_id: FIXTURES.prodA1, quantity: 2 }],
      },
    ];

    const { data, error } = await staffAClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessA,
      p_orders: payload,
    });

    const orderIds = data?.order_ids as string[] | undefined;
    const ok = Boolean(!error && orderIds && orderIds.length === 1);
    assert("EXEC-02", "STAFF can place checkout for active business", ok, error?.message ?? `Created: ${orderIds?.[0]}`);

    if (ok && orderIds) {
      const { data: order } = await adminClient.from("orders").select("*").eq("id", orderIds[0]).single();
      assert("AUDIT-03", "order.placed_by_user_id identifies STAFF Clerk ID", order?.placed_by_user_id === PERSONAS.buyerB.clerkId, `placed_by=${order?.placed_by_user_id}`);
      assert("EXEC-02b", "Fulfillment details saved (seller_delivery + address)", order?.fulfillment_type === "seller_delivery" && order?.delivery_address === "123 Session Road, Baguio City", "Fulfillment saved");
    }
  }

  // TEST 10: Client-provided price cannot affect order total
  {
    // Product price is 150/kg. Client tries to order 2 kg and inject custom price = 10/kg.
    await resetCart(FIXTURES.businessA, [{ product_id: FIXTURES.prodA1, quantity: 2 }]);
    const payload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        items: [{ product_id: FIXTURES.prodA1, quantity: 2, price_per_unit: 10.0 }], // Attempt price tampering
      },
    ];

    const { data } = await ownerAClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessA,
      p_orders: payload,
    });

    const orderId = (data?.order_ids as string[] | undefined)?.[0];
    const order = orderId ? (await adminClient.from("orders").select("total_amount").eq("id", orderId).single()).data : null;
    const expectedTotal = 2 * 150.0; // 300, not 20
    assert("COMM-05", "Client-provided price ignored; total computed from catalog price", Number(order?.total_amount) === expectedTotal, `Total: ${order?.total_amount} (expected ${expectedTotal})`);
  }

  // TEST 11: Decimal quantities work where valid
  {
    // prodA2 supports decimal quantities (e.g. 2.5 kg at 80/kg = 200)
    await resetCart(FIXTURES.businessA, [{ product_id: FIXTURES.prodA2, quantity: 2.5 }]);
    const payload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        items: [{ product_id: FIXTURES.prodA2, quantity: 2.5 }],
      },
    ];

    const { data } = await ownerAClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessA,
      p_orders: payload,
    });

    const orderId = (data?.order_ids as string[] | undefined)?.[0];
    const order = orderId ? (await adminClient.from("orders").select("total_amount").eq("id", orderId).single()).data : null;
    const item = orderId ? (await adminClient.from("order_items").select("quantity, subtotal").eq("order_id", orderId).single()).data : null;

    const ok = Number(item?.quantity) === 2.5 && Number(order?.total_amount) === 200.0;
    assert("COMM-06", "Decimal quantity (2.5 kg) accepted and totaled accurately", ok, `Qty: ${item?.quantity}, Total: ${order?.total_amount}`);
  }

  // TEST 12: Multiple producers create separate orders
  {
    // Cart with items from Farmer A and Farmer B
    await resetCart(FIXTURES.businessA, [
      { product_id: FIXTURES.prodA1, quantity: 2 },
      { product_id: FIXTURES.prodB1, quantity: 3 },
    ]);

    const payload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        items: [{ product_id: FIXTURES.prodA1, quantity: 2 }],
      },
      {
        farmer_clerk_id: PERSONAS.farmerB.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        items: [{ product_id: FIXTURES.prodB1, quantity: 3 }],
      },
    ];

    const { data, error } = await ownerAClient.rpc("place_v4_checkout_orders", {
      p_business_id: FIXTURES.businessA,
      p_orders: payload,
    });

    const orderIds = data?.order_ids as string[] | undefined;
    assert("MULTI-01", "Multi-producer checkout creates separate orders (one per producer)", Boolean(!error && orderIds && orderIds.length === 2), `Count: ${orderIds?.length ?? 0}`);

    if (orderIds && orderIds.length === 2) {
      const { data: o1 } = await adminClient.from("orders").select("farmer_clerk_id").eq("id", orderIds[0]).single();
      const { data: o2 } = await adminClient.from("orders").select("farmer_clerk_id").eq("id", orderIds[1]).single();
      const farmers = new Set([o1?.farmer_clerk_id, o2?.farmer_clerk_id]);
      assert("MULTI-02", "Orders correctly assigned to distinct producers", farmers.has(PERSONAS.farmerA.clerkId) && farmers.has(PERSONAS.farmerB.clerkId), `Farmers: ${[...farmers].join(", ")}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 4. CRITICAL CONCURRENCY TEST
  // ════════════════════════════════════════════════════════════════════════════
  section("4. CRITICAL CONCURRENCY TEST: Shared Cart Double-Checkout");

  {
    // Setup: Single shared cart item in Business A: 5 kg of prodA1
    const testQty = 5;
    await resetCart(FIXTURES.businessA, [{ product_id: FIXTURES.prodA1, quantity: testQty }]);

    const stockBefore = (await adminClient.from("products").select("quantity_available").eq("id", FIXTURES.prodA1).single()).data?.quantity_available ?? 0;
    const ordersCountBefore = (await adminClient.from("orders").select("id", { count: "exact" }).eq("business_id", FIXTURES.businessA)).count ?? 0;

    const checkoutPayload = [
      {
        farmer_clerk_id: PERSONAS.farmerA.clerkId,
        fulfillment_type: "pickup",
        pickup_date: tomorrow,
        notes: "Concurrency race test",
        items: [{ product_id: FIXTURES.prodA1, quantity: testQty }],
      },
    ];

    console.log("  [Race] Firing simultaneous checkouts: OWNER and STAFF of Business A...");

    // Fire both at the nearly identical millisecond via Promise.all
    const [ownerAttempt, staffAttempt] = await Promise.all([
      ownerAClient.rpc("place_v4_checkout_orders", {
        p_business_id: FIXTURES.businessA,
        p_orders: checkoutPayload,
      }),
      staffAClient.rpc("place_v4_checkout_orders", {
        p_business_id: FIXTURES.businessA,
        p_orders: checkoutPayload,
      }),
    ]);

    const ownerOk = !ownerAttempt.error && Boolean(ownerAttempt.data?.order_ids?.length);
    const staffOk = !staffAttempt.error && Boolean(staffAttempt.data?.order_ids?.length);

    console.log(`  [Race Result] OWNER success: ${ownerOk} | STAFF success: ${staffOk}`);
    if (ownerAttempt.error) console.log(`  [Race Detail] OWNER error: ${ownerAttempt.error.message}`);
    if (staffAttempt.error) console.log(`  [Race Detail] STAFF error: ${staffAttempt.error.message}`);

    // Assertion 1: Exactly one succeeded
    const exactlyOneSucceeded = (ownerOk && !staffOk) || (!ownerOk && staffOk);
    assert("RACE-01", "Exactly one concurrent checkout succeeds", exactlyOneSucceeded, `Owner=${ownerOk}, Staff=${staffOk}`);

    // Assertion 2: The failing one encountered a clean cart conflict
    const failedAttempt = ownerOk ? staffAttempt : ownerAttempt;
    const conflictError = failedAttempt.error ? mapCheckoutDatabaseError(failedAttempt.error.message) : null;
    const isConflict = conflictError?.code === "CART_CONFLICT";
    assert("RACE-02", "Failing checkout maps to customer-safe CART_CONFLICT", isConflict, `Error code: ${conflictError?.code ?? "none"} (${failedAttempt.error?.message})`);

    // Assertion 3: Exactly one order was created in DB
    const ordersCountAfter = (await adminClient.from("orders").select("id", { count: "exact" }).eq("business_id", FIXTURES.businessA)).count ?? 0;
    const newOrders = ordersCountAfter - ordersCountBefore;
    assert("RACE-03", "No duplicate orders created (exactly 1 new order)", newOrders === 1, `Created: ${newOrders}`);

    // Assertion 4: Stock decremented exactly once
    const stockAfter = (await adminClient.from("products").select("quantity_available").eq("id", FIXTURES.prodA1).single()).data?.quantity_available ?? 0;
    const stockDelta = stockBefore - stockAfter;
    assert("RACE-04", "No double stock decrement (decremented by ordered qty only)", stockDelta === testQty, `Delta: ${stockDelta}, Expected: ${testQty}`);

    // Assertion 5: No partial cart consumption
    const { data: remainingCart } = await adminClient.from("cart_items").select("*").eq("business_id", FIXTURES.businessA);
    assert("RACE-05", "Cart completely cleared; no orphaned partial lines", remainingCart?.length === 0, `Remaining lines: ${remainingCart?.length}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. Orders & Items RLS Read Isolation
  // ════════════════════════════════════════════════════════════════════════════
  section("5. Orders & Items RLS Read Isolation");

  {
    // Check that OWNER and STAFF of Business A can read Business A's orders via authenticated client
    const { data: ownerOrders, error: ownerErr } = await ownerAClient.from("orders").select("id").eq("business_id", FIXTURES.businessA);
    assert("RLS-01", "OWNER can read Business A's orders through RLS", Boolean(!ownerErr && ownerOrders && ownerOrders.length > 0), `Rows: ${ownerOrders?.length ?? 0}`);

    const { data: staffOrders, error: staffErr } = await staffAClient.from("orders").select("id").eq("business_id", FIXTURES.businessA);
    assert("RLS-02", "STAFF can read Business A's orders through RLS", Boolean(!staffErr && staffOrders && staffOrders.length > 0), `Rows: ${staffOrders?.length ?? 0}`);

    // Non-member of Business A cannot read Business A's orders directed to other producers
    // (farmerB legitimately sees the 1 order directed to them as seller, but must NOT see any order directed to farmerA)
    const { data: foreignSellerOrders, error: foreignErr } = await nonMemberClient
      .from("orders")
      .select("id, farmer_clerk_id")
      .eq("business_id", FIXTURES.businessA)
      .neq("farmer_clerk_id", PERSONAS.farmerB.clerkId);
    assert(
      "RLS-03",
      "Non-member cannot read Business A's orders directed to other producers",
      Boolean(!foreignErr && foreignSellerOrders && foreignSellerOrders.length === 0),
      `Rows exposed: ${foreignSellerOrders?.length ?? 0}`
    );

    // Anonymous client cannot read Business A's orders
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: anonOrders } = await anonClient.from("orders").select("id").eq("business_id", FIXTURES.businessA);
    assert(
      "RLS-04",
      "Anonymous client cannot read Business A's orders (RLS enforced)",
      !anonOrders || anonOrders.length === 0,
      `Rows: ${anonOrders?.length ?? 0}`
    );
  }

  // ── Results Summary ────────────────────────────────────────────────────────
  section("SUMMARY");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error(`\nFAILED TESTS (${failed}):`);
    for (const r of results.filter((r) => !r.passed)) {
      console.error(`  - [${r.id}] ${r.name}: ${r.details}`);
    }
    process.exit(1);
  }
}

// ── Entrypoint ───────────────────────────────────────────────────────────────

run()
  .catch((err) => {
    console.error("\nUnhandled error during verification:", err);
    process.exit(1);
  })
  .finally(async () => {
    await cleanup();
  });
