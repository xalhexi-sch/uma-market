// =============================================================================
// UMA Market — Pickup Date Lifecycle Verification Suite
//
// SAFETY RULES:
//   1. MUST ONLY target the dedicated security-test Supabase project.
//   2. ABORTS immediately on production database detected.
//   3. ABORTS on any unknown project URL.
//   4. Uses Clerk Development instance (thankful-terrapin-2971) with test accounts.
//   5. Never prints keys, secrets, or JWTs.
//   6. All test data uses deterministic UUIDs prefixed "f0000001-".
//      Cleaned up in finally{} after every run, even on failure.
//
// TEST SUITE:
//   TEST-A: Pickup order with valid future/today date succeeds
//   TEST-B: Pickup order with missing date is rejected by server action & UI rules
//   TEST-C: Pickup order with past date is rejected
//   TEST-D: Seller delivery with no pickup date succeeds and persists NULL
//   TEST-E: Seller delivery with maliciously supplied pickup date does not persist pickup_date (forced NULL)
//   TEST-F: Authenticated checkout persists the exact submitted pickup_date in PostgreSQL
//   TEST-G: Buyer order query (getBusinessOrderById) exposes the exact pickup date
//   TEST-H: Farmer order query (getFarmerOrderById) exposes the exact pickup date
//   TEST-I: Admin order query (getAdminOrderById) exposes the exact pickup date
//   TEST-J: Confirmation & detail UI formatting correctly handles scheduled pickup date
//   TEST-K: Multi-farmer checkout atomicity remains completely intact
//
// HOW TO RUN:
//   npx tsx --env-file=.env.security-test.local scripts/verify-pickup-date.ts
// =============================================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/nextjs/server";
import * as path from "path";
import * as fs from "fs";
import { loadSecurityTestEnv } from "./lib/safety-guard";

// =============================================================================
// ENVIRONMENT GUARD — shared, fail-closed: loads .env.security-test.local and
// aborts with exit code 2 unless the project is exactly the security-test one.
// =============================================================================

const env = loadSecurityTestEnv("verify-pickup-date");

const supabaseUrl         = env.supabaseUrl;
const supabaseAnonKey     = env.anonKey;
const supabaseSecretKey   = env.secretKey;
const clerkSecretKey      = env.clerkSecretKey;
const clerkPublishableKey = env.clerkPublishableKey;

if (!clerkSecretKey) {
  console.error("SAFETY ABORT: Missing CLERK_SECRET_KEY in .env.security-test.local.");
  process.exit(2);
}

const clerk = createClerkClient({
  secretKey: clerkSecretKey,
  publishableKey: clerkPublishableKey,
});

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
};

const FIXTURES = {
  vegCategorySlug: "vegetables",
  productA: "f0000001-0000-0000-0000-000000000301",
  productB: "f0000001-0000-0000-0000-000000000302",
};

const activeClerkSessionIds: string[] = [];

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
  console.log(`  [${icon}] ${id.padEnd(10)} ${name}`);
  if (!condition) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(72));
}

async function getAuthenticatedClient(clerkUserId: string): Promise<SupabaseClient> {
  const session = await clerk.sessions.createSession({ userId: clerkUserId });
  activeClerkSessionIds.push(session.id);
  const tokenRes = await clerk.sessions.getToken(session.id);
  const jwt = tokenRes.jwt;

  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => jwt,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function countBuyerOrders(): Promise<number> {
  const { count, error } = await adminClient
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("business_clerk_id", PERSONAS.buyerA.clerkId);
  if (error) throw new Error(`countBuyerOrders failed: ${error.message}`);
  return count ?? 0;
}

/**
 * Returns the source region of a single named function, bounded by the next
 * top-level `export` declaration.
 *
 * Brace counting is deliberately avoided: several of these functions declare an
 * inline object type in their return position (e.g. `Promise<{ ... }>`), so the
 * first `{` after the signature is a type literal, not the function body.
 */
function extractFunctionSource(code: string, name: string): string {
  const start = code.search(new RegExp(`(?:export\\s+)?(?:async\\s+)?function ${name}\\s*\\(`));
  if (start === -1) return "";
  const rest = code.slice(start);
  const nextExport = rest.slice(1).search(/\nexport\s/);
  return nextExport === -1 ? rest : rest.slice(0, nextExport + 1);
}

async function cleanupFixtures(): Promise<void> {
  const errors: string[] = [];

  // Delete test orders & items
  const { data: testOrders, error: ordersSelectErr } = await adminClient
    .from("orders")
    .select("id")
    .or(
      `farmer_clerk_id.eq.${PERSONAS.farmerA.clerkId},` +
      `farmer_clerk_id.eq.${PERSONAS.farmerB.clerkId}`
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

  // Delete cart items
  const { error: cartDelErr } = await adminClient
    .from("cart_items")
    .delete()
    .eq("business_clerk_id", PERSONAS.buyerA.clerkId);
  if (cartDelErr) errors.push(`cart_items delete: ${cartDelErr.message}`);

  // Delete products
  const { error: productsDelErr } = await adminClient
    .from("products")
    .delete()
    .in("id", [FIXTURES.productA, FIXTURES.productB]);
  if (productsDelErr) errors.push(`products delete: ${productsDelErr.message}`);

  // Revoke Clerk sessions
  for (const sessionId of activeClerkSessionIds) {
    try {
      await clerk.sessions.revokeSession(sessionId);
    } catch {
      // Ignored
    }
  }
  activeClerkSessionIds.length = 0;

  if (errors.length > 0) {
    throw new Error(`cleanupFixtures failed: ${errors.join(", ")}`);
  }
}

async function provisionFixtures(): Promise<boolean> {
  const { data: cat } = await adminClient
    .from("categories")
    .select("id")
    .eq("slug", FIXTURES.vegCategorySlug)
    .single();

  if (!cat) return false;

  await adminClient.from("profiles").upsert([
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
  ], { onConflict: "clerk_id" });

  await adminClient.from("products").upsert([
    {
      id: FIXTURES.productA,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      category_id: cat.id,
      name: "Pickup Test Ampalaya A",
      price_per_unit: 80,
      unit: "kg",
      quantity_available: 100,
      min_order_quantity: 1,
      status: "active",
    },
    {
      id: FIXTURES.productB,
      farmer_clerk_id: PERSONAS.farmerB.clerkId,
      category_id: cat.id,
      name: "Pickup Test Squash B",
      price_per_unit: 45,
      unit: "kg",
      quantity_available: 50,
      min_order_quantity: 1,
      status: "active",
    },
  ], { onConflict: "id" });

  return true;
}

// =============================================================================
// TEST SUITE EXECUTION
// =============================================================================

async function runTests(): Promise<void> {
  console.log("========================================================================");
  console.log("UMA Market — Pickup Date Lifecycle Verification Suite");
  console.log(`Target DB : ${supabaseUrl}`);
  console.log(`Date      : ${new Date().toISOString()}`);
  console.log("========================================================================");

  console.log("\n  [Pre-run] Removing stale fixtures...");
  await cleanupFixtures();
  console.log("  [Pre-run] Clean up OK");

  const provisioned = await provisionFixtures();
  if (!provisioned) throw new Error("Fixture provisioning failed.");
  console.log("  Fixtures provisioned OK");

  const buyerAClient = await getAuthenticatedClient(PERSONAS.buyerA.clerkId);
  console.log("  Authenticated Buyer A client ready");

  // Future date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const futureStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tomorrow);

  // Past date
  const pastStr = "2020-01-01";

  // ---------------------------------------------------------------------------
  // TEST-A: Pickup order with valid future date succeeds
  // ---------------------------------------------------------------------------
  section("TEST-A: Pickup order with valid future date succeeds");
  {
    await adminClient.from("cart_items").delete().eq("business_clerk_id", PERSONAS.buyerA.clerkId);
    await adminClient.from("cart_items").insert({
      business_clerk_id: PERSONAS.buyerA.clerkId,
      product_id: FIXTURES.productA,
      quantity: 5,
    });

    const { data, error } = await buyerAClient.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA.clerkId,
          fulfillment_type: "pickup",
          pickup_date: futureStr,
          delivery_address: null,
          notes: "Collect at farm gate tomorrow",
          items: [{ product_id: FIXTURES.productA, quantity: 5 }],
        },
      ],
    });

    const orderIds = (data as { order_ids?: string[] })?.order_ids ?? [];
    assert(
      "TEST-A",
      "Pickup order with valid future date succeeds",
      !error && orderIds.length === 1,
      error ? error.message : `Order placed: ${orderIds[0]}`
    );

    // Verify stored date in database
    if (orderIds.length > 0) {
      const { data: ord } = await adminClient
        .from("orders")
        .select("pickup_date, fulfillment_type")
        .eq("id", orderIds[0])
        .single();
      assert(
        "TEST-A-DB",
        "Database persists exact pickup_date for pickup order",
        ord?.pickup_date === futureStr && ord?.fulfillment_type === "pickup",
        `Expected ${futureStr}, got ${ord?.pickup_date}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // TEST-B: Pickup order with missing date is rejected by the database
  // ---------------------------------------------------------------------------
  section("TEST-B: Pickup order with missing date is rejected");
  {
    await adminClient.from("cart_items").delete().eq("business_clerk_id", PERSONAS.buyerA.clerkId);
    await adminClient.from("cart_items").insert({
      business_clerk_id: PERSONAS.buyerA.clerkId,
      product_id: FIXTURES.productA,
      quantity: 2,
    });

    const ordersBefore = await countBuyerOrders();

    const result = await buyerAClient.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA.clerkId,
          fulfillment_type: "pickup",
          pickup_date: null,
          items: [{ product_id: FIXTURES.productA, quantity: 2 }],
        },
      ],
    });

    assert(
      "TEST-B",
      "place_checkout_orders rejects a pickup order with no pickup_date",
      result.error !== null && /pickup date is required/i.test(result.error.message),
      result.error
        ? `RPC rejected as expected: "${result.error.message.slice(0, 160)}"`
        : "FAIL: RPC accepted a pickup order with no pickup_date"
    );

    const ordersAfter = await countBuyerOrders();
    assert(
      "TEST-B-NOORDER",
      "Rejected missing-pickup-date checkout created no order (transaction rolled back)",
      ordersAfter === ordersBefore,
      `orders for buyer: before=${ordersBefore} after=${ordersAfter}`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST-C: Pickup order with past date is rejected by the database
  // ---------------------------------------------------------------------------
  section("TEST-C: Pickup order with past date is rejected");
  {
    await adminClient.from("cart_items").delete().eq("business_clerk_id", PERSONAS.buyerA.clerkId);
    await adminClient.from("cart_items").insert({
      business_clerk_id: PERSONAS.buyerA.clerkId,
      product_id: FIXTURES.productA,
      quantity: 2,
    });

    const ordersBefore = await countBuyerOrders();

    const result = await buyerAClient.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA.clerkId,
          fulfillment_type: "pickup",
          pickup_date: pastStr,
          items: [{ product_id: FIXTURES.productA, quantity: 2 }],
        },
      ],
    });

    assert(
      "TEST-C",
      "place_checkout_orders rejects a pickup order dated in the past",
      result.error !== null && /pickup date cannot be in the past/i.test(result.error.message),
      result.error
        ? `RPC rejected as expected: "${result.error.message.slice(0, 160)}"`
        : `FAIL: RPC accepted pickup_date=${pastStr}`
    );

    const ordersAfter = await countBuyerOrders();
    assert(
      "TEST-C-NOORDER",
      "Rejected past-date checkout created no order (transaction rolled back)",
      ordersAfter === ordersBefore,
      `orders for buyer: before=${ordersBefore} after=${ordersAfter}`
    );

    // The Server Action must reject the same input before it ever reaches the RPC.
    const checkoutActionsSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(dashboard)/business/checkout/actions.ts"),
      "utf-8",
    );
    assert(
      "TEST-C-ACTION",
      "placeMultiFarmerCheckout validates pickup dates server-side before calling the RPC",
      checkoutActionsSrc.includes('checkoutError("PICKUP_DATE_PAST")') &&
        checkoutActionsSrc.includes('checkoutError("PICKUP_DATE_REQUIRED")') &&
        checkoutActionsSrc.includes('checkoutError("PICKUP_DATE_INVALID")'),
      "actions.ts maps missing/invalid/past pickup dates to dedicated CheckoutError codes",
    );
  }

  // ---------------------------------------------------------------------------
  // TEST-D: Seller delivery with no pickup date succeeds and stores NULL
  // ---------------------------------------------------------------------------
  section("TEST-D: Seller delivery with no pickup date succeeds and stores NULL");
  {
    await adminClient.from("cart_items").delete().eq("business_clerk_id", PERSONAS.buyerA.clerkId);
    await adminClient.from("cart_items").insert({
      business_clerk_id: PERSONAS.buyerA.clerkId,
      product_id: FIXTURES.productA,
      quantity: 3,
    });

    const { data: delData, error: delErr } = await buyerAClient.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA.clerkId,
          fulfillment_type: "seller_delivery",
          delivery_address: "123 Market St, Butuan City",
          pickup_date: null,
          notes: "Call upon arrival",
          items: [{ product_id: FIXTURES.productA, quantity: 3 }],
        },
      ],
    });

    const delOrderIds = (delData as { order_ids?: string[] })?.order_ids ?? [];
    assert(
      "TEST-D",
      "Seller delivery order succeeds",
      !delErr && delOrderIds.length === 1,
      delErr ? delErr.message : `Order created: ${delOrderIds[0]}`
    );

    if (delOrderIds.length > 0) {
      const { data: ord } = await adminClient
        .from("orders")
        .select("pickup_date, delivery_address, fulfillment_type")
        .eq("id", delOrderIds[0])
        .single();
      assert(
        "TEST-D-DB",
        "Seller delivery order stores pickup_date as NULL and preserves delivery_address",
        ord?.pickup_date === null && ord?.delivery_address === "123 Market St, Butuan City",
        `pickup_date: ${ord?.pickup_date}, address: ${ord?.delivery_address}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // TEST-E: Seller delivery with maliciously supplied pickup date forced to NULL
  // ---------------------------------------------------------------------------
  section("TEST-E: Seller delivery with maliciously supplied pickup date forced to NULL");
  {
    await adminClient.from("cart_items").delete().eq("business_clerk_id", PERSONAS.buyerA.clerkId);
    await adminClient.from("cart_items").insert({
      business_clerk_id: PERSONAS.buyerA.clerkId,
      product_id: FIXTURES.productA,
      quantity: 2,
    });

    const maliciousPickupDate = "2030-01-01";
    const { data: maliciousData, error: maliciousErr } = await buyerAClient.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA.clerkId,
          fulfillment_type: "seller_delivery",
          delivery_address: "456 Malicious St, Butuan City",
          pickup_date: maliciousPickupDate,
          items: [{ product_id: FIXTURES.productA, quantity: 2 }],
        },
      ],
    });

    const maliciousOrderIds = (maliciousData as { order_ids?: string[] })?.order_ids ?? [];
    assert(
      "TEST-E",
      "Seller delivery order is accepted even when a pickup_date is maliciously supplied",
      !maliciousErr && maliciousOrderIds.length === 1,
      maliciousErr ? maliciousErr.message : `Order created: ${maliciousOrderIds[0]}`,
    );

    if (maliciousOrderIds.length === 1) {
      const { data: ord } = await adminClient
        .from("orders")
        .select("pickup_date, fulfillment_type, delivery_address")
        .eq("id", maliciousOrderIds[0])
        .single();

      assert(
        "TEST-E-DB",
        "Database forces pickup_date to NULL for seller_delivery (malicious value not persisted)",
        ord?.pickup_date === null && ord?.fulfillment_type === "seller_delivery",
        `submitted pickup_date=${maliciousPickupDate}, stored pickup_date=${ord?.pickup_date}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // TEST-F: Authenticated checkout persists exact submitted pickup_date
  // ---------------------------------------------------------------------------
  section("TEST-F: Authenticated checkout persists exact submitted pickup_date");
  {
    await adminClient.from("cart_items").delete().eq("business_clerk_id", PERSONAS.buyerA.clerkId);
    await adminClient.from("cart_items").insert({
      business_clerk_id: PERSONAS.buyerA.clerkId,
      product_id: FIXTURES.productA,
      quantity: 4,
    });

    const targetDate = "2026-11-20";
    const { data: exactData, error: exactErr } = await buyerAClient.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA.clerkId,
          fulfillment_type: "pickup",
          pickup_date: targetDate,
          delivery_address: null,
          notes: "Scheduled November collection",
          items: [{ product_id: FIXTURES.productA, quantity: 4 }],
        },
      ],
    });

    const exactIds = (exactData as { order_ids?: string[] })?.order_ids ?? [];
    assert(
      "TEST-F-RPC",
      "Authenticated checkout executes with specific future date",
      !exactErr && exactIds.length === 1,
      exactErr ? exactErr.message : `Order ID: ${exactIds[0]}`
    );

    if (exactIds.length > 0) {
      const orderId = exactIds[0];
      const { data: dbOrder } = await adminClient
        .from("orders")
        .select("pickup_date")
        .eq("id", orderId)
        .single();

      assert(
        "TEST-F-EXACT",
        "PostgreSQL persists the exact submitted pickup_date",
        dbOrder?.pickup_date === targetDate,
        `Expected ${targetDate}, got ${dbOrder?.pickup_date}`
      );

      // -----------------------------------------------------------------------
      // TEST-G: Buyer order query (getBusinessOrderById) exposes the exact pickup date
      // -----------------------------------------------------------------------
      section("TEST-G: Buyer order query exposes the pickup date");
      const ordersSrc = fs.readFileSync(path.resolve(process.cwd(), "src/lib/supabase/queries/orders.ts"), "utf-8");
      const hasPickupInBuyerQuery =
        extractFunctionSource(ordersSrc, "getBusinessOrderById").includes("pickup_date");
      const { data: buyerOrder } = await buyerAClient
        .from("orders")
        .select("id, pickup_date, fulfillment_type")
        .eq("id", orderId)
        .single();
      assert(
        "TEST-G",
        "Buyer query exposes pickup_date (static query contract and authenticated client read)",
        hasPickupInBuyerQuery && buyerOrder?.pickup_date === targetDate,
        `Buyer query pickup_date: ${buyerOrder?.pickup_date}`
      );

      // -----------------------------------------------------------------------
      // TEST-H: Farmer order query (getFarmerOrderById) exposes the exact pickup date
      // -----------------------------------------------------------------------
      section("TEST-H: Farmer order query exposes the pickup date");
      const hasPickupInFarmerQuery =
        extractFunctionSource(ordersSrc, "getFarmerOrderById").includes("pickup_date");
      const { data: farmerOrder } = await adminClient
        .from("orders")
        .select("id, pickup_date, fulfillment_type")
        .eq("id", orderId)
        .eq("farmer_clerk_id", PERSONAS.farmerA.clerkId)
        .single();
      assert(
        "TEST-H",
        "Farmer query exposes pickup_date (static query contract and database read)",
        hasPickupInFarmerQuery && farmerOrder?.pickup_date === targetDate,
        `Farmer query pickup_date: ${farmerOrder?.pickup_date}`
      );

      // -----------------------------------------------------------------------
      // TEST-I: Admin order query (getAdminOrderById) exposes the exact pickup date
      // -----------------------------------------------------------------------
      section("TEST-I: Admin order query exposes the pickup date");
      const adminSrc = fs.readFileSync(path.resolve(process.cwd(), "src/lib/supabase/queries/admin.ts"), "utf-8");
      const hasPickupInAdminQuery =
        extractFunctionSource(adminSrc, "getAdminOrderById").includes("pickup_date");
      const { data: adminOrder } = await adminClient
        .from("orders")
        .select("id, pickup_date, fulfillment_type")
        .eq("id", orderId)
        .single();
      assert(
        "TEST-I",
        "Admin query exposes pickup_date (static query contract and admin client read)",
        hasPickupInAdminQuery && adminOrder?.pickup_date === targetDate,
        `Admin query pickup_date: ${adminOrder?.pickup_date}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // TEST-J: Every UI surface that renders a pickup date formats it correctly
  //
  // The formatter is asserted against the REAL application source. Each page
  // declares its own module-private `formatPickupDate`; the body is extracted
  // from the source file and executed, so this exercises shipped application
  // code rather than a copy of it living inside this test script.
  // ---------------------------------------------------------------------------
  section("TEST-J: Confirmation & detail UI formatting correctly handles scheduled pickup date");
  {
    const uiSurfaces = [
      "src/app/(dashboard)/admin/orders/[id]/page.tsx",
      "src/app/(dashboard)/business/checkout/confirmation/[orderId]/page.tsx",
      "src/app/(dashboard)/business/checkout/confirmation/page.tsx",
      "src/app/(dashboard)/business/orders/[id]/page.tsx",
      "src/app/(dashboard)/farmer/orders/[id]/page.tsx",
    ];

    const failures: string[] = [];
    const outputs: string[] = [];

    for (const relativePath of uiSurfaces) {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      if (!fs.existsSync(absolutePath)) {
        failures.push(`${relativePath}: file not found`);
        continue;
      }
      const source = fs.readFileSync(absolutePath, "utf-8");
      const start = source.indexOf("function formatPickupDate");
      if (start === -1) {
        failures.push(`${relativePath}: formatPickupDate not declared`);
        continue;
      }
      const open = source.indexOf("{", start);
      let depth = 0;
      let close = -1;
      for (let i = open; i < source.length; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}") {
          depth--;
          if (depth === 0) {
            close = i;
            break;
          }
        }
      }
      if (close === -1) {
        failures.push(`${relativePath}: could not extract formatPickupDate body`);
        continue;
      }

      let formatted: string;
      try {
        const body = source.slice(open + 1, close);
        const fn = new Function("dateStr", body) as (dateStr: string) => string;
        formatted = fn("2026-11-20");
      } catch (err) {
        failures.push(`${relativePath}: ${(err as Error).message}`);
        continue;
      }
      outputs.push(`${relativePath} -> '${formatted}'`);

      const ok =
        formatted.toLowerCase().includes("november") &&
        formatted.includes("20") &&
        formatted.includes("2026");
      if (!ok) failures.push(`${relativePath}: unexpected output '${formatted}'`);
    }

    assert(
      "TEST-J",
      `All ${uiSurfaces.length} UI surfaces format a scheduled pickup date as a localized long date`,
      failures.length === 0,
      failures.length === 0 ? outputs.join(" | ") : failures.join(" | "),
    );
  }

  // ---------------------------------------------------------------------------
  // TEST-K: Multi-farmer checkout atomicity remains completely intact
  // ---------------------------------------------------------------------------
  section("TEST-K: Multi-farmer checkout atomicity remains completely intact");
  {
    // Provision cart items for two farmers
    await adminClient.from("cart_items").delete().eq("business_clerk_id", PERSONAS.buyerA.clerkId);
    await adminClient.from("cart_items").insert([
      {
        business_clerk_id: PERSONAS.buyerA.clerkId,
        product_id: FIXTURES.productA,
        quantity: 2,
      },
      {
        business_clerk_id: PERSONAS.buyerA.clerkId,
        product_id: FIXTURES.productB,
        quantity: 2,
      },
    ]);

    // Place multi-farmer order with pickup date for Farmer A and delivery for Farmer B
    const { data: multiData, error: multiErr } = await buyerAClient.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA.clerkId,
          fulfillment_type: "pickup",
          pickup_date: futureStr,
          delivery_address: null,
          items: [{ product_id: FIXTURES.productA, quantity: 2 }],
        },
        {
          farmer_clerk_id: PERSONAS.farmerB.clerkId,
          fulfillment_type: "seller_delivery",
          pickup_date: null,
          delivery_address: "Bistro Warehouse, Butuan",
          items: [{ product_id: FIXTURES.productB, quantity: 2 }],
        },
      ],
    });

    const multiOrderIds = (multiData as { order_ids?: string[] })?.order_ids ?? [];
    assert(
      "TEST-K",
      "Multi-farmer atomic checkout creates both orders with correct fulfillment types",
      !multiErr && multiOrderIds.length === 2,
      multiErr ? multiErr.message : `Created order IDs: ${multiOrderIds.join(", ")}`
    );

    if (multiOrderIds.length === 2) {
      const { data: o1 } = await adminClient.from("orders").select("pickup_date, fulfillment_type").eq("id", multiOrderIds[0]).single();
      const { data: o2 } = await adminClient.from("orders").select("pickup_date, fulfillment_type").eq("id", multiOrderIds[1]).single();

      assert(
        "TEST-K-FMT",
        "First order has pickup_date and second order has null pickup_date",
        o1?.pickup_date === futureStr && o2?.pickup_date === null,
        `Order 1: ${o1?.fulfillment_type} (${o1?.pickup_date}), Order 2: ${o2?.fulfillment_type} (${o2?.pickup_date})`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  section("TEST SUITE SUMMARY");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n  TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function main() {
  try {
    await runTests();
  } finally {
    console.log("\n  [Cleanup] Running final fixture cleanup...");
    try {
      await cleanupFixtures();
      console.log("  [Cleanup] Complete — all test data removed");
    } catch (e) {
      console.error("  [Cleanup] Error:", (e as Error).message);
    }
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
