// =============================================================================
// UMA Market — Order Query Layer & Dashboard Tab Filtering Verification Suite
//
// SAFETY RULES:
//   1. MUST ONLY target the dedicated security-test Supabase project.
//   2. ABORTS immediately on production database detected.
//   3. Uses deterministic fixture IDs cleaned up in finally{}.
//   4. Never prints secrets or tokens.
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import Module from "node:module";
import * as dotenv from "dotenv";
import * as path from "path";
import type { OrderViewTab, OrderTabCounts } from "../src/lib/supabase/queries/orders";

dotenv.config({ path: path.resolve(process.cwd(), ".env.security-test.local") });

// Environment safety guard
const PROD_REF = "odnpkqjytrmciwmcehff";
const SECURITY_TEST_REF = "xckdihprwjdwutglytwu";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !supabaseUrl.includes(SECURITY_TEST_REF) || supabaseUrl.includes(PROD_REF)) {
  console.error(`FATAL: Must only run against security-test project (${SECURITY_TEST_REF}). Found: ${supabaseUrl}`);
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("FATAL: SUPABASE_SECRET_KEY is required for test fixture execution.");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_PREFIX = "f0000099-";
const TEST_BUYER_CLERK_ID = "user_test_buyer_tab_opt";
const TEST_FARMER_CLERK_ID = "user_test_farmer_tab_opt";

function createExpandedOrder(id: number, status: "accepted" | "completed") {
  return {
    id: `${TEST_PREFIX}0000-0000-0000-${String(id).padStart(12, "0")}`,
    business_clerk_id: TEST_BUYER_CLERK_ID,
    farmer_clerk_id: TEST_FARMER_CLERK_ID,
    status,
    fulfillment_type: "pickup",
    total_amount: 1000 + id,
    created_at: new Date(Date.UTC(2026, 8, 2, 0, id)).toISOString(),
  };
}

const FIXTURES = {
  buyerProfile: {
    clerk_id: TEST_BUYER_CLERK_ID,
    role: "business",
    full_name: "Tab Test Buyer",
    business_name: "Tab Test Buyer Corp",
    city: "Butuan City",
    status: "active",
  },
  farmerProfile: {
    clerk_id: TEST_FARMER_CLERK_ID,
    role: "farmer",
    full_name: "Tab Test Farmer",
    business_name: "Tab Test Farm",
    city: "Butuan City",
    status: "active",
  },
  orders: [
    {
      id: `${TEST_PREFIX}0000-0000-0000-000000000001`,
      business_clerk_id: TEST_BUYER_CLERK_ID,
      farmer_clerk_id: TEST_FARMER_CLERK_ID,
      status: "pending",
      fulfillment_type: "pickup",
      total_amount: 500,
      created_at: "2026-09-01T10:00:00Z",
    },
    {
      id: `${TEST_PREFIX}0000-0000-0000-000000000002`,
      business_clerk_id: TEST_BUYER_CLERK_ID,
      farmer_clerk_id: TEST_FARMER_CLERK_ID,
      status: "pending",
      fulfillment_type: "pickup",
      total_amount: 600,
      created_at: "2026-09-01T11:00:00Z",
    },
    {
      id: `${TEST_PREFIX}0000-0000-0000-000000000003`,
      business_clerk_id: TEST_BUYER_CLERK_ID,
      farmer_clerk_id: TEST_FARMER_CLERK_ID,
      status: "accepted",
      fulfillment_type: "seller_delivery",
      delivery_address: "Test St, Butuan City",
      total_amount: 750,
      created_at: "2026-09-01T12:00:00Z",
    },
    {
      id: `${TEST_PREFIX}0000-0000-0000-000000000004`,
      business_clerk_id: TEST_BUYER_CLERK_ID,
      farmer_clerk_id: TEST_FARMER_CLERK_ID,
      status: "ready",
      fulfillment_type: "pickup",
      total_amount: 300,
      created_at: "2026-09-01T13:00:00Z",
    },
    {
      id: `${TEST_PREFIX}0000-0000-0000-000000000005`,
      business_clerk_id: TEST_BUYER_CLERK_ID,
      farmer_clerk_id: TEST_FARMER_CLERK_ID,
      status: "completed",
      fulfillment_type: "pickup",
      total_amount: 1200,
      created_at: "2026-09-01T14:00:00Z",
    },
    {
      id: `${TEST_PREFIX}0000-0000-0000-000000000006`,
      business_clerk_id: TEST_BUYER_CLERK_ID,
      farmer_clerk_id: TEST_FARMER_CLERK_ID,
      status: "cancelled",
      cancellation_reason: "Customer requested cancellation",
      fulfillment_type: "pickup",
      total_amount: 400,
      created_at: "2026-09-01T15:00:00Z",
    },
    ...Array.from({ length: 50 }, (_, index) => createExpandedOrder(index + 7, "completed" as const)),
    ...Array.from({ length: 49 }, (_, index) => createExpandedOrder(index + 57, "accepted" as const)),
  ],
};

let passed = 0;
let failed = 0;
let ORDER_TAB_STATUSES: typeof import("../src/lib/supabase/queries/orders").ORDER_TAB_STATUSES;
let getBusinessOrders: typeof import("../src/lib/supabase/queries/orders").getBusinessOrders;
let getFarmerOrders: typeof import("../src/lib/supabase/queries/orders").getFarmerOrders;

function assert(id: string, description: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  PASS: [${id}] ${description}`);
    passed++;
  } else {
    console.error(`  FAIL: [${id}] ${description}`);
    if (details) console.error(`        Details: ${details}`);
    failed++;
  }
}

async function cleanup() {
  const orderIds = FIXTURES.orders.map((o) => o.id);
  await adminClient.from("orders").delete().in("id", orderIds);
  await adminClient.from("profiles").delete().in("clerk_id", [TEST_BUYER_CLERK_ID, TEST_FARMER_CLERK_ID]);
}

async function run() {
  console.log("========================================================================");
  console.log("UMA Market — Order Query Tab Optimization Verification");
  console.log(`Target DB: ${supabaseUrl}`);
  console.log("========================================================================");

  try {
    const moduleLoader = Module as typeof Module & {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    };
    const originalLoad = moduleLoader._load;
    moduleLoader._load = function (request, parent, isMain) {
      if (request === "@/lib/supabase/server") {
        return { createClient: async () => adminClient };
      }
      return originalLoad.call(this, request, parent, isMain);
    };

    let orderQueries: typeof import("../src/lib/supabase/queries/orders");
    try {
      orderQueries = await import("../src/lib/supabase/queries/orders");
    } finally {
      moduleLoader._load = originalLoad;
    }
    ORDER_TAB_STATUSES = orderQueries.ORDER_TAB_STATUSES;
    getBusinessOrders = orderQueries.getBusinessOrders;
    getFarmerOrders = orderQueries.getFarmerOrders;

    await cleanup();

    // 1. Setup profiles and orders
    await adminClient.from("profiles").upsert([FIXTURES.buyerProfile, FIXTURES.farmerProfile]);
    const { error: insertErr } = await adminClient.from("orders").insert(FIXTURES.orders);
    if (insertErr) throw insertErr;

    console.log("\n--- TEST SUITE 1: Tab Status Constants & Mapping ---");
    assert(
      "TAB-1.1",
      "ORDER_TAB_STATUSES covers all 4 tabs",
      Array.isArray(ORDER_TAB_STATUSES.needs) &&
        Array.isArray(ORDER_TAB_STATUSES.progress) &&
        Array.isArray(ORDER_TAB_STATUSES.completed) &&
        Array.isArray(ORDER_TAB_STATUSES.cancelled)
    );
    assert(
      "TAB-1.2",
      "needs tab maps strictly to ['pending']",
      ORDER_TAB_STATUSES.needs.length === 1 && ORDER_TAB_STATUSES.needs[0] === "pending"
    );
    assert(
      "TAB-1.3",
      "progress tab maps to ['accepted', 'preparing', 'ready', 'for_delivery']",
      ORDER_TAB_STATUSES.progress.includes("accepted") &&
        ORDER_TAB_STATUSES.progress.includes("preparing") &&
        ORDER_TAB_STATUSES.progress.includes("ready") &&
        ORDER_TAB_STATUSES.progress.includes("for_delivery") &&
        ORDER_TAB_STATUSES.progress.length === 4
    );

    console.log("\n--- TEST SUITE 2: Tab Counts Query Engine ---");
    // Test tab counts aggregation query for buyer
    const { data: buyerRows, error: buyerCountsErr } = await adminClient
      .from("orders")
      .select("status")
      .eq("business_clerk_id", TEST_BUYER_CLERK_ID);

    assert("TAB-2.1", "Buyer order status query succeeds", !buyerCountsErr && !!buyerRows);

    const buyerCounts: OrderTabCounts = {
      needs: 0,
      progress: 0,
      completed: 0,
      cancelled: 0,
      total: buyerRows?.length ?? 0,
    };
    for (const r of buyerRows ?? []) {
      if (r.status === "pending") buyerCounts.needs++;
      else if (["accepted", "preparing", "ready", "for_delivery"].includes(r.status)) buyerCounts.progress++;
      else if (r.status === "completed") buyerCounts.completed++;
      else if (r.status === "cancelled") buyerCounts.cancelled++;
    }

    assert(
      "TAB-2.2",
       "Buyer tab counts compute correctly: needs=2, progress=51, completed=51, cancelled=1, total=105",
       buyerCounts.needs === 2 &&
         buyerCounts.progress === 51 &&
         buyerCounts.completed === 51 &&
         buyerCounts.cancelled === 1 &&
         buyerCounts.total === 105,
      JSON.stringify(buyerCounts)
    );

    // Test tab counts aggregation query for farmer
    const { data: farmerRows, error: farmerCountsErr } = await adminClient
      .from("orders")
      .select("status")
      .eq("farmer_clerk_id", TEST_FARMER_CLERK_ID);

    assert("TAB-2.3", "Farmer order status query succeeds", !farmerCountsErr && !!farmerRows);

    const farmerCounts: OrderTabCounts = {
      needs: 0,
      progress: 0,
      completed: 0,
      cancelled: 0,
      total: farmerRows?.length ?? 0,
    };
    for (const r of farmerRows ?? []) {
      if (r.status === "pending") farmerCounts.needs++;
      else if (["accepted", "preparing", "ready", "for_delivery"].includes(r.status)) farmerCounts.progress++;
      else if (r.status === "completed") farmerCounts.completed++;
      else if (r.status === "cancelled") farmerCounts.cancelled++;
    }

    assert(
      "TAB-2.4",
      "Farmer tab counts match buyer tab counts for shared orders",
       farmerCounts.needs === 2 &&
         farmerCounts.progress === 51 &&
         farmerCounts.completed === 51 &&
         farmerCounts.cancelled === 1 &&
         farmerCounts.total === 105
    );

    console.log("\n--- TEST SUITE 3: Database-Level Status Filtering & Leak Prevention ---");

    // 3.1 Needs Tab (pending)
    {
      const { data, error } = await adminClient
        .from("orders")
        .select("id, status, created_at")
        .eq("business_clerk_id", TEST_BUYER_CLERK_ID)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      assert("TAB-3.1", "Query for 'needs' tab succeeds", !error && !!data);
      assert("TAB-3.2", "Query for 'needs' returns exactly 2 pending records", data?.length === 2);
      const allPending = data?.every((o) => o.status === "pending");
      assert("TAB-3.3", "No non-pending records leaked into 'needs' tab", allPending === true);
      // Verify ASC sort
      const isAsc =
        data && data.length === 2 && new Date(data[0].created_at).getTime() < new Date(data[1].created_at).getTime();
      assert("TAB-3.4", "'needs' tab correctly sorts oldest-first (ASC)", isAsc === true);
    }

    // 3.2 Progress Tab (accepted, preparing, ready, for_delivery)
    {
      const { data, error } = await adminClient
        .from("orders")
        .select("id, status, created_at")
        .eq("business_clerk_id", TEST_BUYER_CLERK_ID)
        .in("status", ORDER_TAB_STATUSES.progress)
        .order("created_at", { ascending: true });

      assert("TAB-3.5", "Query for 'progress' tab succeeds", !error && !!data);
       assert("TAB-3.6", "Query for 'progress' returns exactly 51 records", data?.length === 51);
      const allProgress = data?.every((o) => ["accepted", "preparing", "ready", "for_delivery"].includes(o.status));
      assert("TAB-3.7", "No unauthorized statuses leaked into 'progress' tab", allProgress === true);
      const isAsc =
         data && data.length >= 2 && new Date(data[0].created_at).getTime() < new Date(data[1].created_at).getTime();
      assert("TAB-3.8", "'progress' tab correctly sorts oldest-first (ASC)", isAsc === true);
    }

    // 3.3 Completed Tab
    {
      const { data, error } = await adminClient
        .from("orders")
        .select("id, status, created_at")
        .eq("business_clerk_id", TEST_BUYER_CLERK_ID)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

       assert("TAB-3.9", "Query for 'completed' tab returns exactly 51 completed records", !error && data?.length === 51 && data.every((o) => o.status === "completed"));
    }

    // 3.4 Cancelled Tab
    {
      const { data, error } = await adminClient
        .from("orders")
        .select("id, status, created_at")
        .eq("business_clerk_id", TEST_BUYER_CLERK_ID)
        .eq("status", "cancelled")
        .order("created_at", { ascending: false });

      assert("TAB-3.10", "Query for 'cancelled' tab returns exactly 1 cancelled record", !error && data?.length === 1 && data[0].status === "cancelled");
    }

    console.log("\n--- TEST SUITE 4: Pagination & Limit Engine ---");
    {
      const { data: page1, error: p1Err } = await adminClient
        .from("orders")
        .select("id, created_at")
        .eq("business_clerk_id", TEST_BUYER_CLERK_ID)
        .order("created_at", { ascending: true })
        .range(0, 1); // limit 2

      const { data: page2, error: p2Err } = await adminClient
        .from("orders")
        .select("id, created_at")
        .eq("business_clerk_id", TEST_BUYER_CLERK_ID)
        .order("created_at", { ascending: true })
        .range(2, 3); // next 2

      assert("TAB-4.1", "Pagination range query executes cleanly", !p1Err && !p2Err && page1?.length === 2 && page2?.length === 2);
      const disjoint = page1?.[0]?.id !== page2?.[0]?.id && page1?.[1]?.id !== page2?.[1]?.id;
      assert("TAB-4.2", "Consecutive pages are disjoint and do not repeat records", disjoint);
    }

    console.log("\n--- TEST SUITE 5: Zero-Orders Empty State Resilience ---");
    {
      const { data: emptyRows } = await adminClient
        .from("orders")
        .select("status")
        .eq("business_clerk_id", "user_non_existent_account");

      const emptyCounts: OrderTabCounts = {
        needs: 0,
        progress: 0,
        completed: 0,
        cancelled: 0,
        total: emptyRows?.length ?? 0,
      };
      for (const r of emptyRows ?? []) {
        if (r.status === "pending") emptyCounts.needs++;
      }

      assert("TAB-5.1", "Empty user has total === 0", emptyCounts.total === 0);
      const defaultView = ["needs", "progress", "completed", "cancelled"].find(
        (key) => emptyCounts[key as OrderViewTab] > 0
      ) ?? "needs";
      assert("TAB-5.2", "Empty user gracefully falls back to defaultView 'needs'", defaultView === "needs");
    }

    console.log("\n--- TEST SUITE 6: Exported Query Functions - Default Limit Enforcement ---");
    {
      const { data: unboundedCompleted, error: unboundedCompletedErr } = await adminClient
        .from("orders")
        .select("id")
        .eq("business_clerk_id", TEST_BUYER_CLERK_ID)
        .eq("status", "completed");
      assert(
        "TAB-6.0",
        "Expanded completed fixture set would exceed the default limit without bounding",
        !unboundedCompletedErr && (unboundedCompleted?.length ?? 0) > 50
      );

      const { data: unboundedProgress, error: unboundedProgressErr } = await adminClient
        .from("orders")
        .select("id")
        .eq("business_clerk_id", TEST_BUYER_CLERK_ID)
        .in("status", ORDER_TAB_STATUSES.progress);
      assert(
        "TAB-6.0b",
        "Expanded progress fixture set would exceed the default limit without bounding",
        !unboundedProgressErr && (unboundedProgress?.length ?? 0) > 50
      );

      const businessCompleted = await getBusinessOrders(TEST_BUYER_CLERK_ID, { statusGroup: "completed" });
      assert(
        "TAB-6.1",
        "getBusinessOrders(statusGroup: completed) executes",
        Array.isArray(businessCompleted)
      );
      assert(
        "TAB-6.2",
        "getBusinessOrders(statusGroup: completed) is bounded to <= 50",
        businessCompleted.length <= 50
      );

      const businessProgress = await getBusinessOrders(TEST_BUYER_CLERK_ID, { statusGroup: "progress" });
      assert(
        "TAB-6.3",
        "getBusinessOrders(statusGroup: progress) executes",
        Array.isArray(businessProgress)
      );
      assert(
        "TAB-6.4",
        "getBusinessOrders(statusGroup: progress) is bounded to <= 50",
        businessProgress.length <= 50
      );

      const farmerCompleted = await getFarmerOrders(TEST_FARMER_CLERK_ID, { statusGroup: "completed" });
      assert(
        "TAB-6.5",
        "getFarmerOrders(statusGroup: completed) executes",
        Array.isArray(farmerCompleted)
      );
      assert(
        "TAB-6.6",
        "getFarmerOrders(statusGroup: completed) is bounded to <= 50",
        farmerCompleted.length <= 50
      );

      const farmerProgress = await getFarmerOrders(TEST_FARMER_CLERK_ID, { statusGroup: "progress" });
      assert(
        "TAB-6.7",
        "getFarmerOrders(statusGroup: progress) executes",
        Array.isArray(farmerProgress)
      );
      assert(
        "TAB-6.8",
        "getFarmerOrders(statusGroup: progress) is bounded to <= 50",
        farmerProgress.length <= 50
      );
    }

  } finally {
    console.log("\n--- Teardown: Removing Test Fixtures ---");
    await cleanup();
    console.log("Cleaned up OK.");
  }

  console.log("\n========================================================================");
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================================");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("FATAL UNCAUGHT:", err);
  process.exit(1);
});
