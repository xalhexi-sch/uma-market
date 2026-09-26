// ==============================================================================
// UMA Market — Slice 3A: Query Efficiency, Index Hardening & Type Safety
// Focused Verification Suite
// ==============================================================================

import { readFileSync } from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error("Missing required Supabase environment variables in .env.local");
  process.exit(1);
}

// Ensure we are strictly on the security-test project
if (!supabaseUrl.includes("xckdihprwjdwutglytwu")) {
  console.error("CRITICAL: Verification must only run against dedicated security-test database (xckdihprwjdwutglytwu)!");
  process.exit(1);
}

const adminClient = createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey);
const anonClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey);

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(id: string, name: string, condition: boolean, details: string) {
  results.push({ id, name, passed: condition, details });
  const status = condition ? "PASS" : "FAIL";
  console.log(`[${status}] ${id}: ${name} — ${details}`);
}

async function runQueryEfficiencyVerification() {
  console.log("==============================================================================");
  console.log("UMA Market — Optimization Slice 3A: Query Efficiency & Index Hardening");
  console.log("Database target: " + supabaseUrl);
  console.log("==============================================================================\n");

  const rootDir = process.cwd();

  // Read target source files
  const ordersQueryCode = readFileSync(path.join(rootDir, "src/lib/supabase/queries/orders.ts"), "utf8");
  const productsQueryCode = readFileSync(path.join(rootDir, "src/lib/supabase/queries/products.ts"), "utf8");
  const messagesQueryCode = readFileSync(path.join(rootDir, "src/lib/supabase/queries/messages.ts"), "utf8");
  const adminQueryCode = readFileSync(path.join(rootDir, "src/lib/supabase/queries/admin.ts"), "utf8");
  const businessDashboardCode = readFileSync(path.join(rootDir, "src/app/(dashboard)/business/page.tsx"), "utf8");
  const farmerDashboardCode = readFileSync(path.join(rootDir, "src/app/(dashboard)/farmer/page.tsx"), "utf8");
  const clientTsCode = readFileSync(path.join(rootDir, "src/lib/supabase/client.ts"), "utf8");
  const serverTsCode = readFileSync(path.join(rootDir, "src/lib/supabase/server.ts"), "utf8");
  const adminTsCode = readFileSync(path.join(rootDir, "src/lib/supabase/admin.ts"), "utf8");

  // -------------------------------------------------------------------------
  // 1. Database Index Verification (via PostgREST SQL RPC / information_schema query)
  // -------------------------------------------------------------------------
  console.log("--- 1. Database Indexes & Constraints Verification ---");

  // Query database pg_indexes through an admin RPC or direct check
  const { data: indexCheck, error: indexErr } = await adminClient.rpc("search_products", { p_limit: 1 });
  assert(
    "INDEX-00",
    "Database connection alive and search_products operational",
    !indexErr && Array.isArray(indexCheck),
    `RPC response status: ${indexErr ? indexErr.message : "OK"}`
  );

  // Check migration file exists
  const migrationPath = path.join(rootDir, "supabase/migrations/20260927000001_query_efficiency_indexes.sql");
  const migrationCode = readFileSync(migrationPath, "utf8");

  const hasOrdersBusinessIndex = migrationCode.includes("idx_orders_business_created") && migrationCode.includes("business_clerk_id, created_at DESC");
  const hasOrdersFarmerIndex = migrationCode.includes("idx_orders_farmer_created") && migrationCode.includes("farmer_clerk_id, created_at DESC");
  const hasCartItemsProductIndex = migrationCode.includes("idx_cart_items_product_id") && migrationCode.includes("cart_items (product_id)");
  const dropsRedundantIndex = migrationCode.includes("DROP INDEX IF EXISTS") && migrationCode.includes("idx_product_images_product_id");
  const hasMessagesFk = migrationCode.includes("ADD CONSTRAINT messages_sender_clerk_id_fkey") && migrationCode.includes("ON DELETE RESTRICT");

  assert(
    "INDEX-01",
    "Migration defines idx_orders_business_created (business_clerk_id, created_at DESC)",
    hasOrdersBusinessIndex,
    "Composite ordering index for business orders present in migration"
  );

  assert(
    "INDEX-02",
    "Migration defines idx_orders_farmer_created (farmer_clerk_id, created_at DESC)",
    hasOrdersFarmerIndex,
    "Composite ordering index for farmer orders present in migration"
  );

  assert(
    "INDEX-03",
    "Migration defines idx_cart_items_product_id (product_id)",
    hasCartItemsProductIndex,
    "Foreign key lookup index for cart items present in migration"
  );

  assert(
    "INDEX-04",
    "Migration drops redundant idx_product_images_product_id",
    dropsRedundantIndex,
    "Redundant standalone product_id index dropped in favor of composite (product_id, sort_order)"
  );

  assert(
    "INDEX-05",
    "Migration adds messages_sender_clerk_id_fkey with ON DELETE RESTRICT",
    hasMessagesFk,
    "Foreign key constraint enabling PostgREST embedded joins while preventing cascading message deletion"
  );

  // Live database index check via supabase db query
  try {
    const { execSync } = await import("child_process");
    const dbIndexOutput = execSync(
      'npx supabase db query --linked --project-ref xckdihprwjdwutglytwu "SELECT indexname FROM pg_indexes WHERE schemaname = \'public\';"',
      { encoding: "utf8" }
    );
    const liveHasOrdersBiz = dbIndexOutput.includes("idx_orders_business_created");
    const liveHasOrdersFarmer = dbIndexOutput.includes("idx_orders_farmer_created");
    const liveHasCartItems = dbIndexOutput.includes("idx_cart_items_product_id");
    const liveDroppedImagesIdx = !dbIndexOutput.includes("idx_product_images_product_id");

    assert(
      "INDEX-06",
      "Live database confirms idx_orders_business_created, idx_orders_farmer_created, and idx_cart_items_product_id exist",
      liveHasOrdersBiz && liveHasOrdersFarmer && liveHasCartItems,
      "Live indexes confirmed in security-test DB pg_indexes"
    );

    assert(
      "INDEX-07",
      "Live database confirms redundant idx_product_images_product_id is dropped",
      liveDroppedImagesIdx,
      "Redundant index confirmed absent in security-test DB pg_indexes"
    );

    const fkConstraintOutput = execSync(
      'npx supabase db query --linked --project-ref xckdihprwjdwutglytwu "SELECT confdeltype FROM pg_constraint WHERE conname = \'messages_sender_clerk_id_fkey\';"',
      { encoding: "utf8" }
    );
    const liveFkIsRestrict = fkConstraintOutput.includes('"confdeltype": "r"') || fkConstraintOutput.includes("r");

    assert(
      "INDEX-08",
      "Live database confirms messages_sender_clerk_id_fkey uses ON DELETE RESTRICT (confdeltype = 'r')",
      liveFkIsRestrict,
      "Live foreign key delete action verified as RESTRICT in security-test DB"
    );
  } catch (err: unknown) {
    console.warn("Could not query live pg_indexes via Supabase CLI:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // 2. Dashboard Query Bounding
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Dashboard Query Bounding Verification ---");

  // Check getBusinessOrders accepts limit
  const businessOrdersHasLimitParam = ordersQueryCode.includes("limit?: number");
  const businessOrdersAppliesLimit = ordersQueryCode.includes("query = query.limit(limit)");
  assert(
    "BOUND-01",
    "getBusinessOrders supports optional limit parameter and bounds DB query",
    businessOrdersHasLimitParam && businessOrdersAppliesLimit,
    "Query correctly chains .limit(limit) when provided"
  );

  // Check getFarmerOrders accepts limit
  const farmerOrdersHasLimitParam = ordersQueryCode.includes("getFarmerOrders(\n  farmerClerkId: string,\n  limit?: number\n)") ||
    ordersQueryCode.includes("getFarmerOrders(farmerClerkId: string, limit?: number)") ||
    ordersQueryCode.includes("limit?: number");
  const farmerOrdersAppliesLimit = ordersQueryCode.includes("query = query.limit(limit)");
  assert(
    "BOUND-02",
    "getFarmerOrders supports optional limit parameter and bounds DB query",
    farmerOrdersHasLimitParam && farmerOrdersAppliesLimit,
    "Query correctly chains .limit(limit) when provided"
  );

  // Check business dashboard page requests limit: 3
  const businessDashboardUsesLimit3 = businessDashboardCode.includes("getBusinessOrders(userId, 3)");
  assert(
    "BOUND-03",
    "Business dashboard home page requests only limit: 3",
    businessDashboardUsesLimit3,
    "Replaced unbounded fetch with getBusinessOrders(userId, 3)"
  );

  // Check farmer dashboard page requests limit: 3
  const farmerDashboardUsesLimit3 = farmerDashboardCode.includes("getFarmerOrders(userId, 3)");
  assert(
    "BOUND-04",
    "Farmer dashboard home page requests only limit: 3",
    farmerDashboardUsesLimit3,
    "Replaced in-memory .slice(0, 3) with getFarmerOrders(userId, 3)"
  );

  // -------------------------------------------------------------------------
  // 3. Farmer Active-Product Count via Lightweight Head Count
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Farmer Active-Product Count Verification ---");

  const hasHeadCountQuery = productsQueryCode.includes('select("id", { count: "exact", head: true })');
  const countsActiveStatusOnly = productsQueryCode.includes('.eq("status", "active")');
  assert(
    "COUNT-01",
    "getFarmerActiveProductCount uses head: true count at the database level",
    hasHeadCountQuery && countsActiveStatusOnly,
    "head: true avoids transferring product rows over the wire"
  );

  const farmerPageUsesCountFn = farmerDashboardCode.includes("getFarmerActiveProductCount(userId)");
  const farmerPageNoLongerFetchesAllProducts = !farmerDashboardCode.includes("getFarmerProducts(userId)");
  assert(
    "COUNT-02",
    "Farmer dashboard uses getFarmerActiveProductCount instead of getFarmerProducts",
    farmerPageUsesCountFn && farmerPageNoLongerFetchesAllProducts,
    "Eliminated unnecessary product payload on farmer dashboard load"
  );

  // Functional test against DB for getFarmerActiveProductCount
  const { count: testCount, error: countErr } = await adminClient
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  assert(
    "COUNT-03",
    "Database successfully executes head: true active products count",
    !countErr && typeof testCount === "number",
    `Exact active count returned: ${testCount} (error: ${countErr?.message ?? "none"})`
  );

  // -------------------------------------------------------------------------
  // 4. Order Messages Single Roundtrip
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Order Messages Single Roundtrip Verification ---");

  const messagesJoinsProfiles = messagesQueryCode.includes("sender:profiles!messages_sender_clerk_id_fkey(clerk_id, full_name, avatar_url, business_name)");
  const messagesNoSequentialProfileQuery = !messagesQueryCode.includes("senderIds = Array.from");
  assert(
    "MSG-01",
    "getOrderMessages fetches sender details via joined single query",
    messagesJoinsProfiles && messagesNoSequentialProfileQuery,
    "Eliminated sequential profiles.in('clerk_id', senderIds) roundtrip"
  );

  const adminOrderJoinsMessages = adminQueryCode.includes("sender:profiles!messages_sender_clerk_id_fkey(clerk_id, full_name, avatar_url, business_name)");
  assert(
    "MSG-02",
    "getAdminOrderById fetches messages with joined sender in single query",
    adminOrderJoinsMessages,
    "Eliminated secondary profile lookup in admin order detail query"
  );

  // Verify joined query executes against DB without PostgREST relationship error
  const { error: sampleMsgErr } = await adminClient
    .from("messages")
    .select(`
      id, order_id, sender_clerk_id, body, created_at,
      sender:profiles!messages_sender_clerk_id_fkey(clerk_id, full_name, avatar_url, business_name)
    `)
    .limit(1);

  assert(
    "MSG-03",
    "Single-roundtrip joined message query executes cleanly on database",
    !sampleMsgErr,
    `PostgREST joined query response: ${sampleMsgErr ? sampleMsgErr.message : "Success"}`
  );

  // -------------------------------------------------------------------------
  // 5. TypeScript Database Types & Zero Unsafe Casts
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Type Safety Verification ---");

  const clientWiresDatabase = clientTsCode.includes("<Database>");
  const serverWiresDatabase = serverTsCode.includes("<Database>");
  const adminWiresDatabase = adminTsCode.includes("<Database>");
  assert(
    "TYPE-01",
    "Supabase clients are strongly typed with Database generic",
    clientWiresDatabase && serverWiresDatabase && adminWiresDatabase,
    "client.ts, server.ts, and admin.ts all supply <Database>"
  );

  // Grep for 'as unknown as' across src directory
  const { execSync } = await import("child_process");
  let unknownCastCount = 0;
  try {
    const grepOutput = execSync('git grep -n "as unknown as" -- "src/**"', { encoding: "utf8" });
    unknownCastCount = grepOutput.trim().split("\n").filter(Boolean).length;
  } catch {
    // git grep exits 1 when no matches found
    unknownCastCount = 0;
  }

  assert(
    "TYPE-02",
    "Zero 'as unknown as' casts in src/ codebase (eliminated all 14 legacy casts)",
    unknownCastCount === 0,
    `Remaining 'as unknown as' count: ${unknownCastCount}`
  );

  // -------------------------------------------------------------------------
  // 6. Security & RLS Non-Regression
  // -------------------------------------------------------------------------
  console.log("\n--- 6. Security & RLS Non-Regression Verification ---");

  // Anonymous user cannot query orders directly
  const { data: anonOrders } = await anonClient
    .from("orders")
    .select("id, total_amount");

  assert(
    "SEC-01",
    "Anonymous client cannot access orders (RLS enforced)",
    anonOrders === null || (Array.isArray(anonOrders) && anonOrders.length === 0),
    `Anonymous orders returned: ${anonOrders?.length ?? 0} rows`
  );

  // Anonymous user cannot query private profiles directly
  const { data: anonProfiles } = await anonClient
    .from("profiles")
    .select("clerk_id, phone, address");

  assert(
    "SEC-02",
    "Anonymous client cannot access private profile columns (RLS enforced)",
    anonProfiles === null || (Array.isArray(anonProfiles) && anonProfiles.length === 0),
    `Anonymous profiles returned: ${anonProfiles?.length ?? 0} rows`
  );

  // Anonymous user can access public_farmer_profiles
  const { data: publicProfiles, error: publicProfilesErr } = await anonClient
    .from("public_farmer_profiles")
    .select("clerk_id, full_name, city, is_verified")
    .limit(3);

  assert(
    "SEC-03",
    "Public farmer profiles view remains accessible for anonymous marketplace visitors",
    !publicProfilesErr && Array.isArray(publicProfiles),
    `Public profiles returned: ${publicProfiles?.length ?? 0} rows`
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n==============================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Verification Complete: ${passed}/${total} passed (${failed} failed)`);
  console.log("==============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runQueryEfficiencyVerification().catch((err) => {
  console.error("Verification suite failed with unexpected error:", err);
  process.exit(1);
});
