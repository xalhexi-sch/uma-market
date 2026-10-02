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
import { readFileSync } from "fs";
import Module from "node:module";
import path from "node:path";
import { loadSecurityTestEnv } from "./lib/safety-guard";
import type { OrderViewTab, OrderTabCounts } from "../src/lib/supabase/queries/orders";

// Environment safety guard (shared): loads .env.security-test.local and aborts
// with exit code 2 unless the resolved project is exactly the security-test one.
const env = loadSecurityTestEnv("verify-order-query-tabs");
const supabaseUrl = env.supabaseUrl;
const serviceRoleKey = env.secretKey;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_BUYER_CLERK_ID = "user_test_buyer_tab_opt";
const TEST_FARMER_CLERK_ID = "user_test_farmer_tab_opt";
/**
 * A second buyer/farmer pair whose ONLY order sits in the "progress" tab.
 * Suite 5 needs real counts where the "needs" tab is empty but a later tab is
 * not, because that is the only shape in which the shipped default-view rule
 * discriminates between "pick the first non-empty tab" and the final
 * `?? "needs"` fallback. Building such a counts object by hand would make the
 * assertion pass by construction.
 *
 * They are a SEPARATE pair on purpose: attaching the order to the shared
 * buyer/farmer would change their totals (105) and break TAB-2.2 / TAB-2.4 /
 * TAB-3.x, which assert the shared fixture set exactly.
 */
const TEST_PROGRESS_ONLY_CLERK_ID = "user_test_buyer_progress_only";
const TEST_PROGRESS_ONLY_FARMER_CLERK_ID = "user_test_farmer_progress_only";

/**
 * Deterministic fixture UUID factory.
 *
 * The namespace segment is built as whole hex groups rather than by string
 * concatenation of a prefix plus a formatted tail. Concatenating `"f0000099-" +
 * "0000-0000-0000-" + tail` is only accidentally well-formed: any change to the
 * prefix length silently produces a truncated/over-long string that no longer
 * parses as a UUID and would be rejected by Postgres at INSERT time, long after
 * the fixture builder ran.
 *
 * Shape: f0000099-0000-4000-8000-<12 hex digits>  (RFC 4122 v4 layout, fixed
 * version/variant nibbles so the value is a structurally valid UUID.)
 */
const FIXTURE_UUID_NAMESPACE = "f0000099-0000-4000-8000";

function fixtureOrderUuid(ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal > 0xffffffffffff) {
    throw new RangeError(`fixtureOrderUuid ordinal out of range: ${ordinal}`);
  }
  return `${FIXTURE_UUID_NAMESPACE}-${ordinal.toString(16).padStart(12, "0")}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function createExpandedOrder(ordinal: number, status: "accepted" | "completed") {
  return {
    id: fixtureOrderUuid(ordinal),
    business_clerk_id: TEST_BUYER_CLERK_ID,
    farmer_clerk_id: TEST_FARMER_CLERK_ID,
    status,
    fulfillment_type: "pickup",
    total_amount: 1000 + ordinal,
    created_at: new Date(Date.UTC(2026, 8, 2, 0, ordinal)).toISOString(),
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
  progressOnlyProfile: {
    clerk_id: TEST_PROGRESS_ONLY_CLERK_ID,
    role: "business",
    full_name: "Tab Progress Only Buyer",
    business_name: "Tab Progress Only Corp",
    city: "Butuan City",
    status: "active",
  },
  progressOnlyFarmerProfile: {
    clerk_id: TEST_PROGRESS_ONLY_FARMER_CLERK_ID,
    role: "farmer",
    full_name: "Tab Progress Only Farmer",
    business_name: "Tab Progress Only Farm",
    city: "Butuan City",
    status: "active",
  },
  orders: [
    {
      id: fixtureOrderUuid(1),
      business_clerk_id: TEST_BUYER_CLERK_ID,
      farmer_clerk_id: TEST_FARMER_CLERK_ID,
      status: "pending",
      fulfillment_type: "pickup",
      total_amount: 500,
      created_at: "2026-09-01T10:00:00Z",
    },
    {
      id: fixtureOrderUuid(2),
      business_clerk_id: TEST_BUYER_CLERK_ID,
      farmer_clerk_id: TEST_FARMER_CLERK_ID,
      status: "pending",
      fulfillment_type: "pickup",
      total_amount: 600,
      created_at: "2026-09-01T11:00:00Z",
    },
    {
      id: fixtureOrderUuid(3),
      business_clerk_id: TEST_BUYER_CLERK_ID,
      farmer_clerk_id: TEST_FARMER_CLERK_ID,
      status: "accepted",
      fulfillment_type: "seller_delivery",
      delivery_address: "Test St, Butuan City",
      total_amount: 750,
      created_at: "2026-09-01T12:00:00Z",
    },
    {
      id: fixtureOrderUuid(4),
      business_clerk_id: TEST_BUYER_CLERK_ID,
      farmer_clerk_id: TEST_FARMER_CLERK_ID,
      status: "ready",
      fulfillment_type: "pickup",
      total_amount: 300,
      created_at: "2026-09-01T13:00:00Z",
    },
    {
      id: fixtureOrderUuid(5),
      business_clerk_id: TEST_BUYER_CLERK_ID,
      farmer_clerk_id: TEST_FARMER_CLERK_ID,
      status: "completed",
      fulfillment_type: "pickup",
      total_amount: 1200,
      created_at: "2026-09-01T14:00:00Z",
    },
    {
      id: fixtureOrderUuid(6),
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
    // Single "progress" order for TEST_PROGRESS_ONLY_CLERK_ID — the only tab this
    // buyer owns. Ordinal 1000 is outside every range used above, and the order is
    // owned by its own farmer so the shared buyer/farmer totals stay at 105.
    {
      id: fixtureOrderUuid(1000),
      business_clerk_id: TEST_PROGRESS_ONLY_CLERK_ID,
      farmer_clerk_id: TEST_PROGRESS_ONLY_FARMER_CLERK_ID,
      status: "accepted",
      fulfillment_type: "pickup",
      total_amount: 900,
      created_at: "2026-09-01T16:00:00Z",
    },
  ],
};

let passed = 0;
let failed = 0;
let ORDER_TAB_STATUSES: typeof import("../src/lib/supabase/queries/orders").ORDER_TAB_STATUSES;
let getBusinessOrders: typeof import("../src/lib/supabase/queries/orders").getBusinessOrders;
let getFarmerOrders: typeof import("../src/lib/supabase/queries/orders").getFarmerOrders;
let getBusinessOrderTabCounts: typeof import("../src/lib/supabase/queries/orders").getBusinessOrderTabCounts;

/**
 * Both shipped order pages select the default view with
 * `VALID_VIEWS.find((key) => tabCounts[key] > 0) ?? "needs"`.
 *
 * TAB-5.3 asserts that exact expression is present in each page; the helper
 * below evaluates the SAME rule against counts produced by the real exported
 * `getBusinessOrderTabCounts()`. That pairing is what keeps TAB-5.4/TAB-5.5
 * honest: the data is real (a missing or mis-shaped fixture fails them) and the
 * rule cannot silently diverge from the application (TAB-5.3 fails).
 */
const ORDER_PAGE_SOURCES = [
  "src/app/(dashboard)/business/orders/page.tsx",
  "src/app/(dashboard)/farmer/orders/page.tsx",
] as const;

function selectDefaultView(counts: OrderTabCounts): OrderViewTab {
  const views: OrderViewTab[] = ["needs", "progress", "completed", "cancelled"];
  return views.find((key) => counts[key] > 0) ?? "needs";
}

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
  await adminClient.from("profiles").delete().in("clerk_id", [TEST_BUYER_CLERK_ID, TEST_FARMER_CLERK_ID, TEST_PROGRESS_ONLY_CLERK_ID, TEST_PROGRESS_ONLY_FARMER_CLERK_ID]);
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
    getBusinessOrderTabCounts = orderQueries.getBusinessOrderTabCounts;

    await cleanup();

    // 1. Setup profiles and orders
    await adminClient.from("profiles").upsert([FIXTURES.buyerProfile, FIXTURES.farmerProfile, FIXTURES.progressOnlyProfile, FIXTURES.progressOnlyFarmerProfile]);
    const { error: insertErr } = await adminClient.from("orders").insert(FIXTURES.orders);
    if (insertErr) throw insertErr;

    console.log("\n--- TEST SUITE 0: Fixture Identity Integrity ---");
    {
      const fixtureIds = FIXTURES.orders.map((o) => o.id);
      const malformed = fixtureIds.filter((id) => !UUID_PATTERN.test(id));
      const duplicates = fixtureIds.filter((id, i) => fixtureIds.indexOf(id) !== i);

      assert(
        "TAB-0.1",
        `All ${fixtureIds.length} generated order fixture IDs are structurally valid RFC 4122 UUIDs`,
        malformed.length === 0,
        malformed.length ? `Malformed: ${malformed.slice(0, 5).join(", ")}` : undefined
      );
      assert(
        "TAB-0.2",
        "All generated order fixture IDs are unique (no accidental truncation/collision)",
        duplicates.length === 0,
        duplicates.length ? `Duplicated: ${[...new Set(duplicates)].slice(0, 5).join(", ")}` : undefined
      );
      assert(
        "TAB-0.3",
        "Fixture ID generation is deterministic (same ordinal always yields the same UUID)",
        fixtureOrderUuid(42) === "f0000099-0000-4000-8000-00000000002a" &&
          fixtureOrderUuid(1) === "f0000099-0000-4000-8000-000000000001",
        `fixtureOrderUuid(42) = ${fixtureOrderUuid(42)}`
      );
    }

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
      const EMPTY_USER = "user_non_existent_account";

      // TAB-5.1 — the query must succeed AND be empty. Without surfacing
      // `error`, a failed query (data === null) satisfies `total === 0` and a
      // broken database would read as a passing empty-state test.
      const { data: emptyRows, error: emptyErr } = await adminClient
        .from("orders")
        .select("status")
        .eq("business_clerk_id", EMPTY_USER);

      assert(
        "TAB-5.1",
        "Empty user's order query succeeds and returns exactly zero rows",
        !emptyErr && Array.isArray(emptyRows) && emptyRows.length === 0,
        emptyErr
          ? `query error: ${emptyErr.message}`
          : `rows returned: ${Array.isArray(emptyRows) ? emptyRows.length : "non-array"}`
      );

      // TAB-5.2 — real EXPORTED behaviour (getBusinessOrderTabCounts) against
      // the real database, instead of a counts object assembled in this file.
      const emptyCounts = await getBusinessOrderTabCounts(EMPTY_USER);
      assert(
        "TAB-5.2",
        "getBusinessOrderTabCounts() reports all-zero counts for a user with no orders",
        emptyCounts.total === 0 &&
          emptyCounts.needs === 0 &&
          emptyCounts.progress === 0 &&
          emptyCounts.completed === 0 &&
          emptyCounts.cancelled === 0,
        `counts: ${JSON.stringify(emptyCounts)}`
      );

      // TAB-5.3 — the default-view rule must actually exist in the SHIPPED
      // pages, otherwise the local evaluation below would drift from the app.
      const DEFAULT_VIEW_RULE = "VALID_VIEWS.find((key) => tabCounts[key] > 0) ?? \"needs\"";
      const missingRule = ORDER_PAGE_SOURCES.filter((relative) => {
        const source = readFileSync(path.join(process.cwd(), relative), "utf8");
        return !source.includes(DEFAULT_VIEW_RULE);
      });
      assert(
        "TAB-5.3",
        "Both shipped order pages derive defaultView from tab counts with a 'needs' fallback",
        missingRule.length === 0,
        missingRule.length ? `rule not found in: ${missingRule.join(", ")}` : undefined
      );

      // TAB-5.4 — the real empty-state fallback.
      assert(
        "TAB-5.4",
        "Default-view rule falls back to 'needs' when every tab count is zero",
        selectDefaultView(emptyCounts) === "needs",
        `counts: ${JSON.stringify(emptyCounts)}`
      );

      // TAB-5.5 — the discriminating case. The 'needs' tab is empty while
      // 'progress' holds one real order, so an unconditional `?? "needs"`
      // fallback (the old tautological assertion) would fail here.
      const progressOnlyCounts = await getBusinessOrderTabCounts(TEST_PROGRESS_ONLY_CLERK_ID);
      assert(
        "TAB-5.5",
        "Default-view rule selects the first NON-EMPTY tab ('progress') when 'needs' is empty",
        progressOnlyCounts.needs === 0 &&
          progressOnlyCounts.progress === 1 &&
          progressOnlyCounts.total === 1 &&
          selectDefaultView(progressOnlyCounts) === "progress",
        `counts: ${JSON.stringify(progressOnlyCounts)} defaultView: ${selectDefaultView(progressOnlyCounts)}`
      );
    }

    console.log("\n--- TEST SUITE 6: Exported Query Functions - Default Limit Enforcement ---");
    {
      const DEFAULT_LIMIT = 50;

      const { data: unboundedCompleted, error: unboundedCompletedErr } = await adminClient
        .from("orders")
        .select("id")
        .eq("business_clerk_id", TEST_BUYER_CLERK_ID)
        .eq("status", "completed");
      assert(
        "TAB-6.0",
        "Expanded completed fixture set would exceed the default limit without bounding",
        !unboundedCompletedErr && (unboundedCompleted?.length ?? 0) > DEFAULT_LIMIT,
        unboundedCompletedErr
          ? `query error: ${unboundedCompletedErr.message}`
          : `unbounded completed rows: ${unboundedCompleted?.length ?? 0}`
      );

      const { data: unboundedProgress, error: unboundedProgressErr } = await adminClient
        .from("orders")
        .select("id")
        .eq("business_clerk_id", TEST_BUYER_CLERK_ID)
        .in("status", ORDER_TAB_STATUSES.progress);
      assert(
        "TAB-6.0b",
        "Expanded progress fixture set would exceed the default limit without bounding",
        !unboundedProgressErr && (unboundedProgress?.length ?? 0) > DEFAULT_LIMIT,
        unboundedProgressErr
          ? `query error: ${unboundedProgressErr.message}`
          : `unbounded progress rows: ${unboundedProgress?.length ?? 0}`
      );

      // Every bounded call below is checked twice: it must return ROWS (an empty
      // array is not a passing query result when fixtures are known to exist)
      // and it must stop at the default limit of 50.
      const boundedSuite: Array<{ label: string; rows: unknown[] }> = [];

      const businessCompleted = await getBusinessOrders(TEST_BUYER_CLERK_ID, { statusGroup: "completed" });
      boundedSuite.push({ label: "getBusinessOrders(statusGroup: completed)", rows: businessCompleted });

      const businessProgress = await getBusinessOrders(TEST_BUYER_CLERK_ID, { statusGroup: "progress" });
      boundedSuite.push({ label: "getBusinessOrders(statusGroup: progress)", rows: businessProgress });

      const farmerCompleted = await getFarmerOrders(TEST_FARMER_CLERK_ID, { statusGroup: "completed" });
      boundedSuite.push({ label: "getFarmerOrders(statusGroup: completed)", rows: farmerCompleted });

      const farmerProgress = await getFarmerOrders(TEST_FARMER_CLERK_ID, { statusGroup: "progress" });
      boundedSuite.push({ label: "getFarmerOrders(statusGroup: progress)", rows: farmerProgress });

      const ids = ["TAB-6.1", "TAB-6.3", "TAB-6.5", "TAB-6.7"];
      const boundIds = ["TAB-6.2", "TAB-6.4", "TAB-6.6", "TAB-6.8"];
      boundedSuite.forEach((entry, index) => {
        assert(
          ids[index],
          `${entry.label} executes and returns rows`,
          Array.isArray(entry.rows) && entry.rows.length > 0,
          `returned ${Array.isArray(entry.rows) ? entry.rows.length : "non-array"} rows`
        );
        assert(
          boundIds[index],
          `${entry.label} is bounded to the default limit of ${DEFAULT_LIMIT}`,
          Array.isArray(entry.rows) && entry.rows.length === DEFAULT_LIMIT,
          `returned ${Array.isArray(entry.rows) ? entry.rows.length : "non-array"} rows, expected exactly ${DEFAULT_LIMIT} (TAB-6.0/6.0b prove the unbounded set exceeds it)`
        );
      });
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
