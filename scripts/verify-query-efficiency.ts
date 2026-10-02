// =============================================================================
// UMA Market — Slice 3A: Query Efficiency, Index Hardening & Type Safety
// Focused Verification Suite
//
// SAFETY RULES:
//   1. Credentials are loaded EXCLUSIVELY from .env.security-test.local.
//      .env.local points at production and is never read by this script.
//   2. ABORTS (exit 2) unless the resolved Supabase project is exactly the
//      dedicated security-test project.
//   3. ABORTS unless the Supabase CLI is linked to the security-test project,
//      because the live pg_indexes / pg_constraint checks go through
//      'supabase db query --linked --output-format json'.
//   4. Never prints secrets.
//   5. Every assertion evaluates a real condition. Nothing is hard-coded to
//      true, no error is swallowed, and any failure exits non-zero.
//   6. The CLI output contract is explicit: JSON is requested with
//      --output-format json, the parser validates the documented shape, and a
//      contract violation throws instead of being coerced into an empty result
//      set (an empty result would make "index absent" read as a pass).
// =============================================================================

import { existsSync, readFileSync } from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import Module from "node:module";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import {
  assertSupabaseCliLinkedToSecurityTest,
  loadSecurityTestEnv,
  SECURITY_TEST_SUPABASE_REF,
} from "./lib/safety-guard";

const SCRIPT = "verify-query-efficiency";

// Environment safety guard (shared): fail-closed, exact-match, security-test only.
const env = loadSecurityTestEnv(SCRIPT);
assertSupabaseCliLinkedToSecurityTest(SCRIPT);

const supabaseUrl = env.supabaseUrl;
const supabaseAnonKey = env.anonKey;
const supabaseServiceKey = env.secretKey;

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
  if (condition) {
    console.log(`[${status}] ${id}: ${name} — ${details}`);
  } else {
    console.error(`[${status}] ${id}: ${name} — ${details}`);
  }
}

/**
 * Absolute path to the repository-local Supabase CLI entrypoint.
 *
 * Invoking the local binary directly (instead of `npx supabase`) makes the call
 * reproducible from a clean checkout and avoids the Windows `npx`/`.cmd` shim
 * resolution problem that made the previous `execSync` path fail silently.
 */
const SUPABASE_CLI_ENTRY = path.join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js");

/**
 * Spawn environment for every CLI invocation.
 *
 * `SUPABASE_TELEMETRY_DISABLED=1` is REQUIRED for correctness, not hygiene: the
 * installed CLI (2.117.0) flushes `~/.supabase/telemetry.json` with a
 * read-modify-write-rename. Two CLI processes that overlap on that file crash on
 * Windows with `EPERM: FileSystem.rename ... telemetry.json.tmp` AFTER the query
 * was issued, which produces a non-zero exit status and an EMPTY stdout. Without
 * this flag `liveSql` intermittently throws on a run that never reached the SQL,
 * which is exactly how the suite dropped from 30/30 to 27/30 and exited 1.
 *
 * `SUPABASE_NO_UPDATE_NOTIFIER=1` keeps the version-notice banner off stderr so
 * captured diagnostics stay about the query.
 */
const SUPABASE_CLI_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  SUPABASE_TELEMETRY_DISABLED: "1",
  SUPABASE_NO_UPDATE_NOTIFIER: "1",
};

/** Shape of a successful `supabase db query --output-format json` payload. */
interface SupabaseCliQueryResult {
  rows: Array<Record<string, unknown>>;
}

function brief(value: string, max = 400): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/**
 * Parses stdout of `supabase db query --output-format json`.
 *
 * The installed CLI emits exactly one JSON document on stdout:
 *   success -> { "boundary": "...", "rows": [ {...}, ... ], "warning": "..." }
 *   CLI/transport failure -> { "_tag": "Error", "error": { code, message } }
 *
 * Anything else (empty stdout after a crash, a banner, a truncated document) is
 * a contract violation and throws — it is NEVER coerced into a `rows` array,
 * because `[]` would silently read "no such index" as a passing assertion.
 */
function parseCliQueryOutput(stdout: string, stderr: string, exitCode: number): SupabaseCliQueryResult {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new Error(
      `supabase db query produced NO stdout (exit=${exitCode}). stderr: ${brief(stderr, 300) || "(empty)"}`,
    );
  }

  // Tolerate a leading non-JSON line (a progress banner) but not a missing document.
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart === -1) {
    throw new Error(
      `supabase db query stdout contains no JSON document (exit=${exitCode}): ${brief(trimmed)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(jsonStart));
  } catch (err) {
    throw new Error(
      `supabase db query stdout is not valid JSON (exit=${exitCode}): ${(err as Error).message} | stdout: ${brief(trimmed)}`,
    );
  }

  const payload = parsed as Partial<SupabaseCliQueryResult> & {
    _tag?: string;
    error?: { code?: string; message?: string };
  };

  if (payload._tag === "Error") {
    throw new Error(
      `supabase db query failed: ${payload.error?.code ?? "unknown code"} — ${payload.error?.message ?? "no message"}`,
    );
  }

  if (!Array.isArray(payload.rows)) {
    throw new Error(
      `Unexpected 'supabase db query' payload shape — expected an array at 'rows'. stdout: ${brief(trimmed)}`,
    );
  }

  return { rows: payload.rows };
}

/**
 * Runs a read-only SQL statement against the linked security-test project via the
 * Supabase CLI and returns the parsed rows.
 *
 * The CLI is invoked with an EXPLICIT `--output-format json`: relying on the
 * default output mode is what made the parser/CLI contract ambiguous.
 *
 * `spawnSync` (not `execFileSync`) is used on purpose so that a non-zero exit
 * status still hands us stdout/stderr for diagnosis. A CLI error or a malformed
 * payload throws; callers convert the throw into an explicit FAIL result — the
 * error is never silently dropped and never becomes a fabricated pass.
 */
function liveSql<T = Record<string, unknown>>(sql: string): T[] {
  if (!existsSync(SUPABASE_CLI_ENTRY)) {
    throw new Error(`Supabase CLI not installed at ${SUPABASE_CLI_ENTRY} — run \`npm ci\`.`);
  }

  const result = spawnSync(
    process.execPath,
    [SUPABASE_CLI_ENTRY, "db", "query", "--linked", "--output-format", "json", sql],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024,
      env: SUPABASE_CLI_ENV,
    },
  );

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (result.error) {
    throw new Error(`supabase db query could not be spawned: ${result.error.message}`);
  }

  // The contract: a complete JSON payload with a `rows` array is authoritative.
  // A non-zero exit WITHOUT such a payload is a hard failure (surfaced with the
  // CLI's own diagnostics); a non-zero exit WITH one is the documented Windows
  // telemetry-flush crash that happens after the result was produced.
  try {
    return parseCliQueryOutput(stdout, stderr, result.status ?? -1).rows as T[];
  } catch (err) {
    throw new Error(`${(err as Error).message} | stderr: ${brief(stderr, 300) || "(empty)"}`);
  }
}

// -----------------------------------------------------------------------------
// Deterministic fixtures for the runtime bounding assertions (LIMIT-*).
// -----------------------------------------------------------------------------

const LIMIT_BUYER_CLERK_ID = "user_query_efficiency_limit_buyer";
const LIMIT_FARMER_CLERK_ID = "user_query_efficiency_limit_farmer";
const LIMIT_ORDER_COUNT = 5;
const LIMIT_ORDER_IDS = Array.from(
  { length: LIMIT_ORDER_COUNT },
  (_, i) => `b0000009-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);

const LIMIT_ORDERS = LIMIT_ORDER_IDS.map((id, i) => ({
  id,
  business_clerk_id: LIMIT_BUYER_CLERK_ID,
  farmer_clerk_id: LIMIT_FARMER_CLERK_ID,
  status: "completed",
  fulfillment_type: "pickup",
  total_amount: 1000 + i,
  created_at: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(),
}));

async function cleanupLimitFixtures() {
  await adminClient.from("orders").delete().in("id", LIMIT_ORDER_IDS);
  await adminClient
    .from("profiles")
    .delete()
    .in("clerk_id", [LIMIT_BUYER_CLERK_ID, LIMIT_FARMER_CLERK_ID]);
}

async function provisionLimitFixtures(): Promise<string | null> {
  await cleanupLimitFixtures();

  const { data: cat } = await adminClient
    .from("categories")
    .select("id")
    .eq("slug", "vegetables")
    .maybeSingle();
  if (!cat) return "category 'vegetables' not found — run `npm run seed:demo` against the security-test project";

  const { error: profErr } = await adminClient.from("profiles").upsert(
    [
      {
        clerk_id: LIMIT_BUYER_CLERK_ID,
        role: "business",
        full_name: "Query Efficiency Buyer",
        business_name: "QE Buyer Co",
        city: "Butuan",
        status: "active",
      },
      {
        clerk_id: LIMIT_FARMER_CLERK_ID,
        role: "farmer",
        full_name: "Query Efficiency Farmer",
        business_name: "QE Farm",
        city: "Butuan",
        status: "active",
      },
    ],
    { onConflict: "clerk_id" },
  );
  if (profErr) return `profiles upsert failed: ${profErr.message}`;

  const { error: ordErr } = await adminClient.from("orders").insert(LIMIT_ORDERS);
  if (ordErr) return `orders insert failed: ${ordErr.message}`;

  return null;
}

// -----------------------------------------------------------------------------

async function runQueryEfficiencyVerification() {
  console.log("==============================================================================");
  console.log("UMA Market — Optimization Slice 3A: Query Efficiency & Index Hardening");
  console.log(`Database target: ${supabaseUrl}`);
  console.log(`Supabase CLI linked project: ${SECURITY_TEST_SUPABASE_REF} (verified)`);
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
  // 1. Database Index Verification
  // -------------------------------------------------------------------------
  console.log("--- 1. Database Indexes & Constraints Verification ---");

  const { data: indexCheck, error: indexErr } = await adminClient.rpc("search_products", { p_limit: 1 });
  assert(
    "INDEX-00",
    "Database connection alive and search_products operational",
    !indexErr && Array.isArray(indexCheck),
    `RPC response status: ${indexErr ? indexErr.message : "OK"}`,
  );

  // Check migration file exists
  const migrationPath = path.join(rootDir, "supabase/migrations/20260927000001_query_efficiency_indexes.sql");
  const migrationCode = readFileSync(migrationPath, "utf8");

  const hasOrdersBusinessIndex =
    migrationCode.includes("idx_orders_business_created") &&
    migrationCode.includes("business_clerk_id, created_at DESC");
  const hasOrdersFarmerIndex =
    migrationCode.includes("idx_orders_farmer_created") &&
    migrationCode.includes("farmer_clerk_id, created_at DESC");
  const hasCartItemsProductIndex =
    migrationCode.includes("idx_cart_items_product_id") && migrationCode.includes("cart_items (product_id)");
  const dropsRedundantIndex =
    migrationCode.includes("DROP INDEX IF EXISTS") && migrationCode.includes("idx_product_images_product_id");
  const hasMessagesFk =
    migrationCode.includes("ADD CONSTRAINT messages_sender_clerk_id_fkey") &&
    migrationCode.includes("ON DELETE RESTRICT");

  assert(
    "INDEX-01",
    "Migration defines idx_orders_business_created (business_clerk_id, created_at DESC)",
    hasOrdersBusinessIndex,
    "Composite ordering index for business orders present in migration",
  );

  assert(
    "INDEX-02",
    "Migration defines idx_orders_farmer_created (farmer_clerk_id, created_at DESC)",
    hasOrdersFarmerIndex,
    "Composite ordering index for farmer orders present in migration",
  );

  assert(
    "INDEX-03",
    "Migration defines idx_cart_items_product_id (product_id)",
    hasCartItemsProductIndex,
    "Foreign key lookup index for cart items present in migration",
  );

  assert(
    "INDEX-04",
    "Migration drops redundant idx_product_images_product_id",
    dropsRedundantIndex,
    "Redundant standalone product_id index dropped in favor of composite (product_id, sort_order)",
  );

  assert(
    "INDEX-05",
    "Migration adds messages_sender_clerk_id_fkey with ON DELETE RESTRICT",
    hasMessagesFk,
    "Foreign key constraint enabling PostgREST embedded joins while preventing cascading message deletion",
  );

  // Live database checks through 'supabase db query --linked'.
  // The link target was already asserted to be the security-test project.
  let liveIndexNames: string[] | null = null;
  try {
    liveIndexNames = liveSql<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('idx_orders_business_created','idx_orders_farmer_created','idx_cart_items_product_id','idx_product_images_product_id')",
    ).map((r) => r.indexname);
  } catch (err) {
    liveIndexNames = null;
    const message = (err as Error).message.slice(0, 300);
    assert(
      "INDEX-06",
      "Live database confirms idx_orders_business_created, idx_orders_farmer_created, and idx_cart_items_product_id exist",
      false,
      `'supabase db query --linked' failed: ${message}`,
    );
    assert(
      "INDEX-07",
      "Live database confirms redundant idx_product_images_product_id is dropped",
      false,
      `'supabase db query --linked' failed: ${message}`,
    );
    assert(
      "INDEX-08",
      "Live database confirms messages_sender_clerk_id_fkey uses ON DELETE RESTRICT (confdeltype = 'r')",
      false,
      `'supabase db query --linked' failed: ${message}`,
    );
  }

  if (liveIndexNames !== null) {
    assert(
      "INDEX-06",
      "Live database confirms idx_orders_business_created, idx_orders_farmer_created, and idx_cart_items_product_id exist",
      liveIndexNames.includes("idx_orders_business_created") &&
        liveIndexNames.includes("idx_orders_farmer_created") &&
        liveIndexNames.includes("idx_cart_items_product_id"),
      `Observed indexes: ${liveIndexNames.join(", ") || "(none)"}`,
    );

    assert(
      "INDEX-07",
      "Live database confirms redundant idx_product_images_product_id is dropped",
      !liveIndexNames.includes("idx_product_images_product_id"),
      `idx_product_images_product_id ${liveIndexNames.includes("idx_product_images_product_id") ? "is still present (FAIL)" : "is absent as expected"}`,
    );

    let fkRows: Array<{ confdeltype: string }> | null = null;
    let fkError = "";
    try {
      fkRows = liveSql<{ confdeltype: string }>(
        "SELECT confdeltype FROM pg_constraint WHERE conname = 'messages_sender_clerk_id_fkey'",
      );
    } catch (err) {
      fkError = (err as Error).message.slice(0, 300);
    }

    if (fkRows === null) {
      assert(
        "INDEX-08",
        "Live database confirms messages_sender_clerk_id_fkey uses ON DELETE RESTRICT (confdeltype = 'r')",
        false,
        `'supabase db query --linked' failed: ${fkError}`,
      );
    } else {
      // Strict, non-tautological: exactly one row must exist and its confdeltype
      // must be exactly "r" (RESTRICT). No substring matching on free-form output.
      assert(
        "INDEX-08",
        "Live database confirms messages_sender_clerk_id_fkey uses ON DELETE RESTRICT (confdeltype = 'r')",
        fkRows.length === 1 && fkRows[0].confdeltype === "r",
        `Rows: ${JSON.stringify(fkRows)} (expected exactly one row with confdeltype === "r")`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // 2. Dashboard Query Bounding
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Dashboard Query Bounding Verification ---");

  // Extract the source region of a single exported function so the assertions
  // below are about THAT function, not about any occurrence of a string in the
  // file. Brace counting is avoided because these functions may declare inline
  // object types in their return position.
  function extractFunctionSource(code: string, name: string): string {
    const start = code.search(new RegExp(`export\\s+async\\s+function ${name}\\s*\\(`));
    if (start === -1) return "";
    const rest = code.slice(start);
    const nextExport = rest.slice(1).search(/\nexport\s/);
    return nextExport === -1 ? rest : rest.slice(0, nextExport + 1);
  }

  const getBusinessOrdersSrc = extractFunctionSource(ordersQueryCode, "getBusinessOrders");
  const getFarmerOrdersSrc = extractFunctionSource(ordersQueryCode, "getFarmerOrders");

  assert(
    "BOUND-01",
    "getBusinessOrders accepts OrderQueryOptions|number and always applies an explicit limit",
    getBusinessOrdersSrc.length > 0 &&
      getBusinessOrdersSrc.includes("optionsOrLimit?: OrderQueryOptions | number") &&
      getBusinessOrdersSrc.includes("query = query.limit(effectiveLimit)"),
    `getBusinessOrders source length: ${getBusinessOrdersSrc.length}`,
  );

  assert(
    "BOUND-02",
    "getFarmerOrders accepts OrderQueryOptions|number and always applies an explicit limit",
    getFarmerOrdersSrc.length > 0 &&
      getFarmerOrdersSrc.includes("optionsOrLimit?: OrderQueryOptions | number") &&
      getFarmerOrdersSrc.includes("query = query.limit(effectiveLimit)"),
    `getFarmerOrders source length: ${getFarmerOrdersSrc.length}`,
  );

  assert(
    "BOUND-05",
    "Both order queries default the effective limit to 50",
    getBusinessOrdersSrc.includes("options.limit && options.limit > 0 ? options.limit : 50") &&
      getFarmerOrdersSrc.includes("options.limit && options.limit > 0 ? options.limit : 50"),
    "Effective-limit fallback of 50 present in both getBusinessOrders and getFarmerOrders",
  );

  // Runtime proof that the bound is actually applied to the outgoing query.
  {
    const fixtureError = await provisionLimitFixtures();
    assert("LIMIT-00", `Seeded ${LIMIT_ORDER_COUNT} deterministic orders for runtime bounding checks`, fixtureError === null, fixtureError ?? "fixtures provisioned");

    if (fixtureError === null) {
      const moduleLoader = Module as typeof Module & {
        _load: (request: string, parent: unknown, isMain: boolean) => unknown;
      };
      const originalLoad = moduleLoader._load;
      const adminScoped = adminClient as unknown as SupabaseClient;
      moduleLoader._load = function (request, parent, isMain) {
        if (request === "@/lib/supabase/server") {
          return { createClient: async () => adminScoped };
        }
        return originalLoad.call(this, request, parent, isMain);
      };

      let getBusinessOrders: typeof import("../src/lib/supabase/queries/orders").getBusinessOrders;
      let getFarmerOrders: typeof import("../src/lib/supabase/queries/orders").getFarmerOrders;
      try {
        const mod = await import("../src/lib/supabase/queries/orders");
        getBusinessOrders = mod.getBusinessOrders;
        getFarmerOrders = mod.getFarmerOrders;
      } finally {
        moduleLoader._load = originalLoad;
      }

      const bizLimited = await getBusinessOrders(LIMIT_BUYER_CLERK_ID, { statusGroup: "completed", limit: 3 });
      assert(
        "LIMIT-01",
        "getBusinessOrders honours an explicit limit of 3 against a 5-row fixture set",
        bizLimited.length === 3,
        `Returned ${bizLimited.length} row(s) (expected exactly 3)`,
      );

      const bizDefault = await getBusinessOrders(LIMIT_BUYER_CLERK_ID, { statusGroup: "completed" });
      assert(
        "LIMIT-02",
        "getBusinessOrders default limit of 50 returns the whole 5-row fixture set (not truncated)",
        bizDefault.length === LIMIT_ORDER_COUNT,
        `Returned ${bizDefault.length} row(s) (expected ${LIMIT_ORDER_COUNT})`,
      );

      const farmerLimited = await getFarmerOrders(LIMIT_FARMER_CLERK_ID, { statusGroup: "completed", limit: 3 });
      assert(
        "LIMIT-03",
        "getFarmerOrders honours an explicit limit of 3 against a 5-row fixture set",
        farmerLimited.length === 3,
        `Returned ${farmerLimited.length} row(s) (expected exactly 3)`,
      );

      const farmerDefault = await getFarmerOrders(LIMIT_FARMER_CLERK_ID, { statusGroup: "completed" });
      assert(
        "LIMIT-04",
        "getFarmerOrders default limit of 50 returns the whole 5-row fixture set (not truncated)",
        farmerDefault.length === LIMIT_ORDER_COUNT,
        `Returned ${farmerDefault.length} row(s) (expected ${LIMIT_ORDER_COUNT})`,
      );

      await cleanupLimitFixtures();
    }
  }

  // Check business dashboard page requests limit: 3
  const businessDashboardUsesLimit3 = businessDashboardCode.includes("getBusinessOrders(userId, 3)");
  assert(
    "BOUND-03",
    "Business dashboard home page requests only limit: 3",
    businessDashboardUsesLimit3,
    "Replaced unbounded fetch with getBusinessOrders(userId, 3)",
  );

  // Check farmer dashboard page requests limit: 3
  const farmerDashboardUsesLimit3 = farmerDashboardCode.includes("getFarmerOrders(userId, 3)");
  assert(
    "BOUND-04",
    "Farmer dashboard home page requests only limit: 3",
    farmerDashboardUsesLimit3,
    "Replaced in-memory .slice(0, 3) with getFarmerOrders(userId, 3)",
  );

  // -------------------------------------------------------------------------
  // 3. Farmer Active-Product Count via Lightweight Head Count
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Farmer Active-Product Count Verification ---");

  const getActiveCountSrc = extractFunctionSource(productsQueryCode, "getFarmerActiveProductCount");
  assert(
    "COUNT-01",
    "getFarmerActiveProductCount uses head: true count scoped to active products",
    getActiveCountSrc.length > 0 &&
      getActiveCountSrc.includes('select("id", { count: "exact", head: true })') &&
      getActiveCountSrc.includes('.eq("status", "active")'),
    `getFarmerActiveProductCount source length: ${getActiveCountSrc.length}`,
  );

  const farmerPageUsesCountFn = farmerDashboardCode.includes("getFarmerActiveProductCount(userId)");
  const farmerPageNoLongerFetchesAllProducts = !farmerDashboardCode.includes("getFarmerProducts(userId)");
  assert(
    "COUNT-02",
    "Farmer dashboard uses getFarmerActiveProductCount instead of getFarmerProducts",
    farmerPageUsesCountFn && farmerPageNoLongerFetchesAllProducts,
    "Eliminated unnecessary product payload on farmer dashboard load",
  );

  // Functional test against DB for the exact head-count query
  const { count: testCount, error: countErr } = await adminClient
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  assert(
    "COUNT-03",
    "Database successfully executes head: true active products count",
    !countErr && typeof testCount === "number",
    `Exact active count returned: ${testCount} (error: ${countErr?.message ?? "none"})`,
  );

  // -------------------------------------------------------------------------
  // 4. Order Messages Single Roundtrip
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Order Messages Single Roundtrip Verification ---");

  const messagesJoinsProfiles =
    messagesQueryCode.includes(
      "sender:profiles!messages_sender_clerk_id_fkey(clerk_id, full_name, avatar_url, business_name)",
    ) && !messagesQueryCode.includes("senderIds = Array.from");
  assert(
    "MSG-01",
    "getOrderMessages fetches sender details via joined single query",
    messagesJoinsProfiles,
    "Eliminated sequential profiles.in('clerk_id', senderIds) roundtrip",
  );

  const adminOrderJoinsMessages = adminQueryCode.includes(
    "sender:profiles!messages_sender_clerk_id_fkey(clerk_id, full_name, avatar_url, business_name)",
  );
  assert(
    "MSG-02",
    "getAdminOrderById fetches messages with joined sender in single query",
    adminOrderJoinsMessages,
    "Eliminated secondary profile lookup in admin order detail query",
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
    `PostgREST joined query response: ${sampleMsgErr ? sampleMsgErr.message : "Success"}`,
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
    `client.ts=${clientWiresDatabase}, server.ts=${serverWiresDatabase}, admin.ts=${adminWiresDatabase}`,
  );

  // 'git grep' exits 0 on match, 1 on no match, and >1 on a real error.
  // Only exit code 1 means "zero casts"; anything else is a genuine failure.
  const grepResult = spawnSync("git", ["grep", "-n", "as unknown as", "--", "src"], {
    encoding: "utf8",
  });
  let grepOutcome: string;
  let unknownCastCount: number;
  if (grepResult.status === 1) {
    unknownCastCount = 0;
    grepOutcome = "git grep exit 1 (no matches)";
  } else if (grepResult.status === 0) {
    unknownCastCount = (grepResult.stdout ?? "").trim().split("\n").filter(Boolean).length;
    grepOutcome = `git grep exit 0 (${unknownCastCount} match(es))`;
  } else {
    unknownCastCount = -1;
    grepOutcome = `git grep failed with status ${grepResult.status}: ${(grepResult.stderr ?? "").slice(0, 200)}`;
  }

  assert(
    "TYPE-02",
    "Zero 'as unknown as' casts in src/ codebase",
    unknownCastCount === 0,
    `${grepOutcome}`,
  );

  // -------------------------------------------------------------------------
  // 6. Security & RLS Non-Regression
  // -------------------------------------------------------------------------
  console.log("\n--- 6. Security & RLS Non-Regression Verification ---");

  const { data: anonOrders, error: anonOrdersErr } = await anonClient.from("orders").select("id, total_amount");

  assert(
    "SEC-01",
    "Anonymous client cannot access orders (RLS enforced)",
    anonOrdersErr !== null || anonOrders === null || (Array.isArray(anonOrders) && anonOrders.length === 0),
    anonOrdersErr
      ? `RLS error: ${anonOrdersErr.message}`
      : `Anonymous orders returned: ${anonOrders?.length ?? 0} rows`,
  );

  const { data: anonProfiles, error: anonProfilesErr } = await anonClient
    .from("profiles")
    .select("clerk_id, phone, address");

  assert(
    "SEC-02",
    "Anonymous client cannot access private profile columns (RLS enforced)",
    anonProfilesErr !== null || anonProfiles === null || (Array.isArray(anonProfiles) && anonProfiles.length === 0),
    anonProfilesErr
      ? `RLS error: ${anonProfilesErr.message}`
      : `Anonymous profiles returned: ${anonProfiles?.length ?? 0} rows`,
  );

  const { data: publicProfiles, error: publicProfilesErr } = await anonClient
    .from("public_farmer_profiles")
    .select("clerk_id, full_name, city, is_verified")
    .limit(3);

  assert(
    "SEC-03",
    "Public farmer profiles view remains accessible for anonymous marketplace visitors",
    !publicProfilesErr && Array.isArray(publicProfiles),
    publicProfilesErr
      ? `Error: ${publicProfilesErr.message}`
      : `Public profiles returned: ${publicProfiles?.length ?? 0} rows`,
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n==============================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  if (failed > 0) {
    console.error("Failed tests:");
    results.filter((r) => !r.passed).forEach((r) => console.error(`  [FAIL] ${r.id}: ${r.name} — ${r.details}`));
  }
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