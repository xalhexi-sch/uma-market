/**
 * UMA Market V4 — LIVE verification: business provisioning foundation
 *
 * SAFETY RULES:
 *   1. Credentials loaded exclusively from .env.security-test.local.
 *   2. Aborts (exit 2) unless pointing at the dedicated security-test project,
 *      and unless the Supabase CLI link (catalog checks) targets it too.
 *   3. Authorization cases run as a real Clerk Development session or as anon,
 *      never as service_role. service_role only seeds fixtures and calls the
 *      provisioning function where that is the trusted path under test.
 *   4. Synthetic profiles use Clerk IDs prefixed "user_provtest_" (never real
 *      Clerk users). Leftovers from earlier runs are removed before and after.
 *
 * REQUIRES migration 20261007000000_v4_business_provisioning.sql applied to the
 * security-test project.
 *
 * COVERS:
 *   CAT   function is SECURITY DEFINER with search_path=public; EXECUTE only for
 *         service_role; profile trigger is AFTER INSERT only and skips admin;
 *         no INSERT/DELETE policies on businesses / business_members.
 *   PROV  farmer → one SELL business + OWNER; business → one BUY business + OWNER;
 *         admin skipped (trigger and direct call); unknown profile skipped.
 *   IDEM  rerunning provisioning changes nothing; profile UPDATE does not provision.
 *   ORPH  profile without a business is repaired; business without members is
 *         claimed by its legacy owner; business operated by others is refused.
 *   RACE  concurrent provisioning → exactly one business + one membership.
 *   PROD  NULL products.business_id linked; products of another business untouched.
 *   CART  legacy cart rows move to the buying business; conflicting legacy rows
 *         and existing business cart rows are preserved; non-buying business
 *         carts are not moved.
 *   AUTH  anon/authenticated cannot insert businesses/memberships, cannot delete
 *         businesses, cannot execute provisioning, cannot rewrite legacy_clerk_id.
 *
 * HOW TO RUN:
 *   npm run verify:v4-business-provisioning
 */

import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/nextjs/server";
import {
  assertClerkDevelopmentKey,
  assertSupabaseCliLinkedToSecurityTest,
  loadSecurityTestEnv,
} from "./lib/safety-guard";

const SCRIPT = "verify-v4-business-provisioning";

// ── Environment Guard ────────────────────────────────────────────────────────

const env = loadSecurityTestEnv(SCRIPT);
assertClerkDevelopmentKey(SCRIPT, env.clerkSecretKey);
assertSupabaseCliLinkedToSecurityTest(SCRIPT);

const adminClient: SupabaseClient = createClient(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClient: SupabaseClient = createClient(env.supabaseUrl, env.anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clerk = createClerkClient({
  secretKey: env.clerkSecretKey,
  publishableKey: env.clerkPublishableKey,
});

const activeClerkSessionIds: string[] = [];

async function getAuthenticatedClient(userId: string): Promise<SupabaseClient> {
  const session = await clerk.sessions.createSession({ userId });
  activeClerkSessionIds.push(session.id);
  const { jwt } = await clerk.sessions.getToken(session.id);
  return createClient(env.supabaseUrl, env.anonKey, {
    accessToken: async () => jwt,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Clerk Development persona shared with the other V4 live suites.
const PERSONA = "user_3JhUSQewYXAYXR80cEFQNwGvsZs";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PREFIX = "user_provtest_";
const U = {
  farmer: `${PREFIX}farmer`,
  buyer: `${PREFIX}buyer`,
  admin: `${PREFIX}admin`,
  orphan: `${PREFIX}orphan`,
  race: `${PREFIX}race`,
  claim: `${PREFIX}claim`,
  victim: `${PREFIX}victim`,
  squatted: `${PREFIX}squatted`,
  missing: `${PREFIX}missing`, // never gets a profile
};

const id = (n: number) => `d5000007-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const FIX = {
  personaBusiness: id(0x101), // owned by PERSONA, legacy_clerk_id = U.squatted
  squatBusiness: id(0x102), // legacy_clerk_id = U.victim, operated by PERSONA
  pSeller: id(0x201), // sold by U.farmer, used in carts
  pSeller2: id(0x202),
  pSeller3: id(0x203),
  pOrphanNull: id(0x204), // U.orphan listing created while orphaned
  pOrphanOther: id(0x205), // U.orphan listing that belongs to another business
};

// ── Test infrastructure ──────────────────────────────────────────────────────

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(testId: string, name: string, condition: boolean, details = ""): boolean {
  results.push({ id: testId, name, passed: condition, details });
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${testId.padEnd(10)} ${name}`);
  if (!condition && details) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(76)}\n  ${title}\n${"=".repeat(76)}`);
}

function must<T>(label: string, res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
}

interface RpcOutcome {
  ok: boolean;
  code: string | null;
  message: string;
  data: unknown;
}

async function provision(client: SupabaseClient, clerkId: string): Promise<RpcOutcome> {
  const { data, error } = await client.rpc("provision_owner_business", { p_clerk_id: clerkId });
  return { ok: !error, code: error?.code ?? null, message: error?.message ?? "", data };
}

interface BusinessRow {
  id: string;
  name: string;
  can_buy: boolean;
  can_sell: boolean;
  status: string;
  legacy_clerk_id: string | null;
}

async function businessesOf(clerkId: string): Promise<BusinessRow[]> {
  return must(
    "businesses",
    await adminClient
      .from("businesses")
      .select("id, name, can_buy, can_sell, status, legacy_clerk_id")
      .eq("legacy_clerk_id", clerkId)
  ) as BusinessRow[];
}

async function membershipsOf(clerkId: string): Promise<Array<{ business_id: string; role: string }>> {
  return must(
    "business_members",
    await adminClient.from("business_members").select("business_id, role").eq("user_id", clerkId)
  ) as Array<{ business_id: string; role: string }>;
}

/** Exactly one business for the user, and the user's only membership is OWNER of it. */
async function provisionedOnce(clerkId: string): Promise<{ ok: boolean; business?: BusinessRow; details: string }> {
  const [biz, members] = await Promise.all([businessesOf(clerkId), membershipsOf(clerkId)]);
  const ok =
    biz.length === 1 && members.length === 1 && members[0].business_id === biz[0].id && members[0].role === "OWNER";
  return { ok, business: biz[0], details: `businesses=${biz.length} memberships=${JSON.stringify(members)}` };
}

async function insertProfile(clerkId: string, role: string, extra: Record<string, unknown> = {}) {
  return adminClient.from("profiles").insert({ clerk_id: clerkId, role, full_name: `Provtest ${role}`, ...extra });
}

/** Removes the user's legacy business (memberships cascade; products.business_id → NULL; V4 cart rows cascade). */
async function orphan(clerkId: string): Promise<void> {
  must("orphan", await adminClient.from("businesses").delete().eq("legacy_clerk_id", clerkId));
}

async function productBusiness(productId: string): Promise<string | null> {
  const row = must(
    "product",
    await adminClient.from("products").select("business_id").eq("id", productId).single()
  ) as { business_id: string | null };
  return row.business_id;
}

// ── Catalog checks through the linked CLI ────────────────────────────────────

const SUPABASE_CLI_ENTRY = path.join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js");

function liveSql<T = Record<string, unknown>>(sql: string): T[] {
  const result = spawnSync(
    process.execPath,
    [SUPABASE_CLI_ENTRY, "db", "query", "--linked", "--output-format", "json", sql],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1", SUPABASE_NO_UPDATE_NOTIFIER: "1" },
    }
  );
  if (result.error) throw new Error(`supabase db query could not be spawned: ${result.error.message}`);
  const out = (result.stdout ?? "").trim();
  const starts = [out.indexOf("{"), out.indexOf("[")].filter((i) => i !== -1);
  if (starts.length === 0) {
    throw new Error(`supabase db query returned no JSON (exit=${result.status}): ${(result.stderr ?? "").slice(0, 300)}`);
  }
  const parsed = JSON.parse(out.slice(Math.min(...starts))) as unknown;
  if (Array.isArray(parsed)) return parsed as T[];
  const payload = parsed as { rows?: unknown; _tag?: string; error?: { message?: string } };
  if (payload._tag === "Error") throw new Error(`supabase db query failed: ${payload.error?.message}`);
  if (!Array.isArray(payload.rows)) throw new Error(`unexpected supabase db query payload: ${out.slice(0, 300)}`);
  return payload.rows as T[];
}

function catalogChecks(): void {
  section("CAT — function, grants, trigger and policy shape");

  const [fn] = liveSql<{ secdef: boolean; config: string | null }>(
    "SELECT p.prosecdef AS secdef, array_to_string(p.proconfig, ',') AS config " +
      "FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace " +
      "WHERE n.nspname = 'public' AND p.proname = 'provision_owner_business'"
  );
  assert("CAT-01", "provision_owner_business is SECURITY DEFINER", fn?.secdef === true, JSON.stringify(fn));
  assert("CAT-02", "provision_owner_business pins search_path=public", fn?.config === "search_path=public", JSON.stringify(fn));

  const [grants] = liveSql<Record<string, boolean>>(
    "SELECT " +
      "has_function_privilege('anon', 'public.provision_owner_business(text)', 'EXECUTE') AS anon, " +
      "has_function_privilege('authenticated', 'public.provision_owner_business(text)', 'EXECUTE') AS auth, " +
      "has_function_privilege('service_role', 'public.provision_owner_business(text)', 'EXECUTE') AS service, " +
      "EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.proname = 'provision_owner_business' AND a.grantee = 0) AS public_grant, " +
      "has_function_privilege('anon', 'public.trigger_provision_owner_business()', 'EXECUTE') " +
      "  OR has_function_privilege('authenticated', 'public.trigger_provision_owner_business()', 'EXECUTE') AS trigger_fn_client"
  );
  assert(
    "CAT-03",
    "EXECUTE: service_role only (no PUBLIC, anon, authenticated)",
    grants?.service === true && grants.anon === false && grants.auth === false && grants.public_grant === false,
    JSON.stringify(grants)
  );
  assert("CAT-04", "Trigger function is not executable by clients", grants?.trigger_fn_client === false, JSON.stringify(grants));

  const triggers = liveSql<{ def: string }>(
    "SELECT pg_get_triggerdef(t.oid) AS def FROM pg_trigger t " +
      "WHERE t.tgrelid = 'public.profiles'::regclass AND NOT t.tgisinternal " +
      "AND t.tgfoid = 'public.trigger_provision_owner_business'::regproc"
  );
  const def = triggers[0]?.def ?? "";
  assert(
    "CAT-05",
    "Profile trigger is AFTER INSERT only, row-level, skips admin",
    triggers.length === 1 &&
      /AFTER INSERT ON public\.profiles FOR EACH ROW/.test(def) &&
      !/UPDATE/.test(def) &&
      /role IS DISTINCT FROM 'admin'/.test(def),
    def || "(no trigger)"
  );

  const policies = liveSql<{ tbl: string; cmd: string }>(
    "SELECT tablename AS tbl, cmd FROM pg_policies WHERE schemaname = 'public' " +
      "AND tablename IN ('businesses', 'business_members') AND cmd IN ('INSERT', 'DELETE', 'ALL')"
  );
  assert("CAT-06", "No INSERT/DELETE/ALL policies on businesses or business_members", policies.length === 0, JSON.stringify(policies));
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  const like = `${PREFIX}%`;
  const fixtureBusinesses = [FIX.personaBusiness, FIX.squatBusiness];
  const steps: Array<[string, PromiseLike<{ error: { message: string } | null }>]> = [
    ["cart_items(legacy)", adminClient.from("cart_items").delete().like("business_clerk_id", like)],
    ["cart_items(products)", adminClient.from("cart_items").delete().in("product_id", Object.values(FIX))],
    ["products", adminClient.from("products").delete().like("farmer_clerk_id", like)],
    ["businesses(legacy)", adminClient.from("businesses").delete().like("legacy_clerk_id", like)],
    ["businesses(fixtures)", adminClient.from("businesses").delete().in("id", fixtureBusinesses)],
    ["business_members", adminClient.from("business_members").delete().like("user_id", like)],
    ["profiles", adminClient.from("profiles").delete().like("clerk_id", like)],
  ];
  for (const [label, step] of steps) {
    const { error } = await step;
    if (error) console.error(`  cleanup ${label}: ${error.message}`);
  }
  for (const sessionId of activeClerkSessionIds.splice(0)) {
    try {
      await clerk.sessions.revokeSession(sessionId);
    } catch {
      // Session may already be gone.
    }
  }
}

// ── Suite ────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`  Target: ${env.supabaseUrl}`);
  await cleanup();

  catalogChecks();

  // ── PROV ──────────────────────────────────────────────────────────────────
  section("PROV — profile insert provisions exactly one business + OWNER");

  must("farmer profile", await insertProfile(U.farmer, "farmer", { business_name: "  Provtest Farm  " }));
  const farmer = await provisionedOnce(U.farmer);
  assert("PROV-01", "Farmer profile → one business + one OWNER membership", farmer.ok, farmer.details);
  assert(
    "PROV-02",
    "Farmer business keeps legacy mapping (SELL only, active, named from business_name)",
    farmer.business?.can_sell === true &&
      farmer.business.can_buy === false &&
      farmer.business.status === "active" &&
      farmer.business.name === "Provtest Farm" &&
      farmer.business.legacy_clerk_id === U.farmer,
    JSON.stringify(farmer.business)
  );

  must("buyer profile", await insertProfile(U.buyer, "business"));
  const buyer = await provisionedOnce(U.buyer);
  assert("PROV-03", "Business profile → one business + one OWNER membership", buyer.ok, buyer.details);
  assert(
    "PROV-04",
    "Buyer business keeps legacy mapping (BUY only, named from full_name)",
    buyer.business?.can_buy === true && buyer.business.can_sell === false && buyer.business.name === "Provtest business",
    JSON.stringify(buyer.business)
  );

  must("admin profile", await insertProfile(U.admin, "admin"));
  const adminDirect = await provision(adminClient, U.admin);
  const adminBiz = await businessesOf(U.admin);
  const adminMembers = await membershipsOf(U.admin);
  assert(
    "PROV-05",
    "Admin profile is skipped (trigger and direct call create nothing)",
    adminDirect.ok && adminDirect.data === null && adminBiz.length === 0 && adminMembers.length === 0,
    `rpc=${JSON.stringify(adminDirect)} businesses=${adminBiz.length} memberships=${adminMembers.length}`
  );

  const missing = await provision(adminClient, U.missing);
  assert(
    "PROV-06",
    "Clerk ID without a profile is skipped",
    missing.ok && missing.data === null && (await businessesOf(U.missing)).length === 0,
    JSON.stringify(missing)
  );

  const empty = await provision(adminClient, "  ");
  assert("PROV-07", "Empty Clerk ID is rejected", !empty.ok && empty.code === "22023", JSON.stringify(empty));

  // ── IDEM ──────────────────────────────────────────────────────────────────
  section("IDEM — rerun is a no-op; profile UPDATE does not provision");

  const reruns = await Promise.all([1, 2, 3].map(() => provision(adminClient, U.farmer)));
  const again = await provisionedOnce(U.farmer);
  assert(
    "IDEM-01",
    "Rerunning provisioning returns the same business and creates no duplicates",
    reruns.every((r) => r.ok && r.data === farmer.business?.id) && again.ok && again.business?.id === farmer.business?.id,
    `${JSON.stringify(reruns.map((r) => r.data))} ${again.details}`
  );
  assert(
    "IDEM-02",
    "Rerun does not rewrite capabilities, name or status",
    JSON.stringify(again.business) === JSON.stringify(farmer.business),
    `${JSON.stringify(farmer.business)} → ${JSON.stringify(again.business)}`
  );

  // ── ORPH + PROD ───────────────────────────────────────────────────────────
  section("ORPH/PROD — orphaned profile repaired, listings reconciled");

  must("orphan profile", await insertProfile(U.orphan, "farmer"));
  await orphan(U.orphan);
  must(
    "orphan listings",
    await adminClient.from("products").insert([
      { id: FIX.pOrphanNull, farmer_clerk_id: U.orphan, name: "Provtest orphan listing", price_per_unit: 10, quantity_available: 5 },
      {
        id: FIX.pOrphanOther,
        farmer_clerk_id: U.orphan,
        business_id: buyer.business?.id,
        name: "Provtest other-business listing",
        price_per_unit: 10,
        quantity_available: 5,
      },
    ])
  );
  assert(
    "ORPH-01",
    "Precondition: orphaned profile has no business; its new listing has NULL business_id",
    (await businessesOf(U.orphan)).length === 0 && (await productBusiness(FIX.pOrphanNull)) === null
  );

  must("orphan profile update", await adminClient.from("profiles").update({ full_name: "Provtest orphan" }).eq("clerk_id", U.orphan));
  assert("IDEM-03", "Profile UPDATE does not provision", (await businessesOf(U.orphan)).length === 0);

  const repair = await provision(adminClient, U.orphan);
  const repaired = await provisionedOnce(U.orphan);
  assert("ORPH-02", "Orphaned profile is repaired: one business + OWNER", repair.ok && repaired.ok, `${JSON.stringify(repair)} ${repaired.details}`);
  assert(
    "PROD-01",
    "Listing with NULL business_id is linked to the repaired business",
    (await productBusiness(FIX.pOrphanNull)) === repaired.business?.id
  );
  assert(
    "PROD-02",
    "Listing already owned by another business is not reassigned",
    (await productBusiness(FIX.pOrphanOther)) === buyer.business?.id
  );

  // Business row survived but lost its members: the legacy owner reclaims it.
  must("claim profile", await insertProfile(U.claim, "business"));
  const claimBefore = await provisionedOnce(U.claim);
  must("drop claim membership", await adminClient.from("business_members").delete().eq("user_id", U.claim));
  const reclaim = await provision(adminClient, U.claim);
  const claimAfter = await provisionedOnce(U.claim);
  assert(
    "ORPH-03",
    "Business without members is reclaimed by its legacy owner (same business id)",
    reclaim.ok && claimAfter.ok && claimAfter.business?.id === claimBefore.business?.id,
    `${JSON.stringify(reclaim)} ${claimAfter.details}`
  );

  // ── RACE ──────────────────────────────────────────────────────────────────
  section("RACE — concurrent provisioning");

  must("race profile", await insertProfile(U.race, "business"));
  await orphan(U.race);
  const burst = await Promise.all(Array.from({ length: 12 }, () => provision(adminClient, U.race)));
  const raced = await provisionedOnce(U.race);
  const ids = new Set(burst.map((r) => r.data));
  assert(
    "RACE-01",
    "12 concurrent calls on an orphaned profile → exactly one business + one membership",
    burst.every((r) => r.ok) && ids.size === 1 && raced.ok && ids.has(raced.business?.id),
    `${JSON.stringify(burst.filter((r) => !r.ok))} ids=${ids.size} ${raced.details}`
  );

  must("drop race membership", await adminClient.from("business_members").delete().eq("user_id", U.race));
  const burst2 = await Promise.all(Array.from({ length: 12 }, () => provision(adminClient, U.race)));
  const raced2 = await provisionedOnce(U.race);
  assert(
    "RACE-02",
    "12 concurrent reclaims of a member-less business → exactly one OWNER membership",
    burst2.every((r) => r.ok) && raced2.ok && raced2.business?.id === raced.business?.id,
    `${JSON.stringify(burst2.filter((r) => !r.ok))} ${raced2.details}`
  );

  // ── CART ──────────────────────────────────────────────────────────────────
  section("CART — legacy cart rows reconciled without data loss");

  must(
    "seller listings",
    await adminClient.from("products").insert(
      [FIX.pSeller, FIX.pSeller2, FIX.pSeller3].map((pid, i) => ({
        id: pid,
        farmer_clerk_id: U.farmer,
        name: `Provtest listing ${i + 1}`,
        price_per_unit: 25,
        quantity_available: 100,
      }))
    )
  );
  const buyerBiz = buyer.business?.id as string;
  must(
    "cart seed",
    await adminClient.from("cart_items").insert([
      // Existing business cart row for pSeller (V4).
      { business_id: buyerBiz, business_clerk_id: U.buyer, product_id: FIX.pSeller, quantity: 5 },
      // Legacy rows: one conflicting with the V4 row, one free.
      { business_id: null, business_clerk_id: U.buyer, product_id: FIX.pSeller, quantity: 7 },
      { business_id: null, business_clerk_id: U.buyer, product_id: FIX.pSeller2, quantity: 3 },
      // Legacy row of a SELL-only business.
      { business_id: null, business_clerk_id: U.farmer, product_id: FIX.pSeller3, quantity: 2 },
    ])
  );

  const cartRun = await provision(adminClient, U.buyer);
  await provision(adminClient, U.farmer);
  const cart = must(
    "cart rows",
    await adminClient
      .from("cart_items")
      .select("business_id, business_clerk_id, product_id, quantity")
      .in("business_clerk_id", [U.buyer, U.farmer])
  ) as Array<{ business_id: string | null; business_clerk_id: string; product_id: string; quantity: number }>;
  const find = (clerkId: string, productId: string, businessId: string | null) =>
    cart.filter((r) => r.business_clerk_id === clerkId && r.product_id === productId && r.business_id === businessId);

  assert(
    "CART-01",
    "Free legacy cart row moves to the buyer business with its quantity",
    cartRun.ok && find(U.buyer, FIX.pSeller2, buyerBiz).length === 1 && find(U.buyer, FIX.pSeller2, buyerBiz)[0].quantity === 3,
    JSON.stringify(cart)
  );
  assert(
    "CART-02",
    "Existing business cart row is unchanged; conflicting legacy row is preserved, not merged or deleted",
    find(U.buyer, FIX.pSeller, buyerBiz).length === 1 &&
      find(U.buyer, FIX.pSeller, buyerBiz)[0].quantity === 5 &&
      find(U.buyer, FIX.pSeller, null).length === 1 &&
      find(U.buyer, FIX.pSeller, null)[0].quantity === 7,
    JSON.stringify(cart)
  );
  assert(
    "CART-03",
    "Legacy cart row of a SELL-only business is not moved",
    find(U.farmer, FIX.pSeller3, null).length === 1,
    JSON.stringify(cart)
  );
  assert("CART-04", "No cart rows lost", cart.length === 4, `rows=${cart.length}`);

  const sellerListings = must(
    "seller listings",
    await adminClient.from("products").select("id, business_id").eq("farmer_clerk_id", U.farmer)
  ) as Array<{ id: string; business_id: string | null }>;
  assert(
    "PROD-03",
    "Listings inserted after provisioning derive the provisioned business",
    sellerListings.length === 3 && sellerListings.every((p) => p.business_id === farmer.business?.id),
    JSON.stringify(sellerListings)
  );

  // ── AUTH ──────────────────────────────────────────────────────────────────
  section("AUTH — clients cannot provision or create business ownership");

  const persona = await getAuthenticatedClient(PERSONA);

  // A business the persona legitimately owns (fixture), anchored to a synthetic Clerk ID.
  must(
    "persona business",
    await adminClient.from("businesses").insert({
      id: FIX.personaBusiness,
      name: "Provtest persona business",
      can_buy: true,
      can_sell: false,
      legacy_clerk_id: U.squatted,
    })
  );
  must(
    "persona membership",
    await adminClient.from("business_members").insert({ business_id: FIX.personaBusiness, user_id: PERSONA, role: "OWNER" })
  );

  for (const [label, client] of [
    ["anon", anonClient],
    ["authenticated", persona],
  ] as const) {
    const tag = label === "anon" ? "A" : "B";
    const before = (await businessesOf(U.victim)).length;

    const ins = await client
      .from("businesses")
      .insert({ name: "Provtest injected", can_buy: true, can_sell: true, legacy_clerk_id: U.victim })
      .select("id");
    assert(
      `AUTH-01${tag}`,
      `${label}: cannot insert a business`,
      ins.error?.code === "42501" && (await businessesOf(U.victim)).length === before,
      `${ins.error?.code} ${ins.error?.message ?? "insert succeeded"}`
    );

    const [target] = await businessesOf(U.orphan);
    const mem = await client
      .from("business_members")
      .insert({ business_id: target.id, user_id: label === "anon" ? U.victim : PERSONA, role: "OWNER" })
      .select("id");
    const intruders = must(
      "members",
      await adminClient.from("business_members").select("user_id").eq("business_id", target.id)
    ) as Array<{ user_id: string }>;
    assert(
      `AUTH-02${tag}`,
      `${label}: cannot insert an OWNER membership into another business`,
      mem.error?.code === "42501" && intruders.length === 1 && intruders[0].user_id === U.orphan,
      `${mem.error?.code} ${mem.error?.message ?? "insert succeeded"}`
    );

    const del = await client.from("businesses").delete().eq("id", FIX.personaBusiness).select("id");
    const stillThere = must("persona business", await adminClient.from("businesses").select("id").eq("id", FIX.personaBusiness)) as unknown[];
    assert(
      `AUTH-03${tag}`,
      `${label}: cannot delete a business (even one it owns)`,
      stillThere.length === 1 && (!!del.error || (del.data ?? []).length === 0),
      del.error?.message ?? `deleted=${(del.data ?? []).length}`
    );

    await orphan(U.orphan);
    const rpcSelf = await provision(client, label === "anon" ? U.orphan : PERSONA);
    const rpcVictim = await provision(client, U.orphan);
    assert(
      `AUTH-04${tag}`,
      `${label}: cannot execute provision_owner_business`,
      rpcSelf.code === "42501" && rpcVictim.code === "42501" && (await businessesOf(U.orphan)).length === 0,
      `self=${rpcSelf.code} ${rpcSelf.message} | victim=${rpcVictim.code} ${rpcVictim.message}`
    );
    const restored = await provision(adminClient, U.orphan);
    if (!restored.ok) throw new Error(`re-provision orphan: ${restored.message}`);
  }

  const rewrite = await persona
    .from("businesses")
    .update({ legacy_clerk_id: U.victim })
    .eq("id", FIX.personaBusiness)
    .select("id");
  const anchor = must(
    "persona business",
    await adminClient.from("businesses").select("legacy_clerk_id").eq("id", FIX.personaBusiness).single()
  ) as { legacy_clerk_id: string };
  if (anchor.legacy_clerk_id !== U.squatted) {
    await adminClient.from("businesses").update({ legacy_clerk_id: U.squatted }).eq("id", FIX.personaBusiness);
  }
  assert(
    "AUTH-05",
    "OWNER cannot rewrite their business's legacy_clerk_id",
    rewrite.error?.code === "42501" && anchor.legacy_clerk_id === U.squatted,
    `${rewrite.error?.code} ${rewrite.error?.message ?? "update succeeded"}`
  );

  const rename = await persona.from("businesses").update({ name: "Provtest persona renamed" }).eq("id", FIX.personaBusiness).select("id");
  assert(
    "AUTH-06",
    "OWNER can still rename their business (guard is column-scoped)",
    !rename.error && (rename.data ?? []).length === 1,
    rename.error?.message ?? ""
  );

  // Defense in depth: a business anchored to a not-yet-provisioned user but
  // operated by someone else must never absorb that user.
  must(
    "squat business",
    await adminClient.from("businesses").insert({
      id: FIX.squatBusiness,
      name: "Provtest squat",
      can_buy: true,
      can_sell: true,
      legacy_clerk_id: U.victim,
    })
  );
  must(
    "squat membership",
    await adminClient.from("business_members").insert({ business_id: FIX.squatBusiness, user_id: PERSONA, role: "OWNER" })
  );
  const victimInsert = await insertProfile(U.victim, "business");
  const victimMembers = await membershipsOf(U.victim);
  assert(
    "AUTH-07",
    "Provisioning refuses to attach a user to a business operated by other members",
    victimInsert.error?.code === "42501" && victimMembers.length === 0,
    `${victimInsert.error?.code} ${victimInsert.error?.message ?? "profile insert succeeded"} memberships=${victimMembers.length}`
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let crashed = false;
  try {
    await run();
  } catch (err) {
    crashed = true;
    console.error("\n  FATAL:", err instanceof Error ? err.message : err);
  } finally {
    await cleanup();
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${"=".repeat(76)}`);
  console.log(`  ${results.length - failed.length}/${results.length} passed${crashed ? " (run aborted early)" : ""}`);
  for (const f of failed) console.log(`  FAILED ${f.id}: ${f.name} — ${f.details}`);
  console.log("=".repeat(76));
  process.exit(failed.length === 0 && !crashed ? 0 : 1);
}

main();
