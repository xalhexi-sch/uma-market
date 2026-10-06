/**
 * UMA Market V4 — LIVE verification: F9 business OWNER column-restricted UPDATE
 *
 * FINDING UNDER TEST:
 *   The UPDATE policy "businesses: owner can update business" targets rows only.
 *   Postgres RLS cannot restrict columns, so before F9 an authenticated OWNER
 *   could rewrite can_buy / can_sell / status on their own business — granting
 *   themselves capabilities or lifting a platform suspension.
 *
 * SAFETY RULES:
 *   1. Credentials loaded exclusively from .env.security-test.local.
 *   2. Aborts (exit 2) unless pointing at the dedicated security-test project,
 *      and unless the Supabase CLI link (catalog checks) targets it too.
 *   3. Authorization cases run as a real Clerk Development session or as anon,
 *      never as service_role. service_role only seeds fixtures and performs the
 *      platform/admin status changes under test.
 *   4. Fixture businesses use deterministic UUIDs prefixed "d5000009-" with
 *      legacy_clerk_id NULL, so no real profile or provisioning row is touched.
 *      Everything is removed before and after the run.
 *
 * REQUIRES migration 20261009000000_v4_business_owner_rls_hardening.sql applied
 * to the security-test project.
 *
 * COVERS:
 *   CAT    guard trigger installed; guard function invoker-scoped, pinned
 *          search_path and not client-executable; exactly one OWNER-only UPDATE
 *          policy on businesses; business_members still default-deny.
 *   ALLOW  OWNER can rename their business (profile-safe field preserved).
 *   OWN    OWNER cannot change can_buy, can_sell, status, legacy_clerk_id,
 *          id or created_at.
 *   STAFF  STAFF cannot rename, cannot change status/capabilities, cannot
 *          promote itself to OWNER.
 *   CROSS  another business's OWNER cannot rename, suspend or add members to
 *          this business.
 *   MEMB   an OWNER cannot add an OWNER membership to a different business.
 *   SUSP   suspended/revoked stays that way for its OWNER; the platform
 *          (service_role) can still suspend and restore.
 *   ANON   anonymous cannot update, insert or delete.
 *   PLAT   service_role may still set capabilities/status; an admin JWT has no
 *          direct UPDATE on a business it does not own (unchanged behaviour).
 *
 * HOW TO RUN:
 *   npm run verify:v4-business-owner-rls
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

const SCRIPT = "verify-v4-business-owner-rls";

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

// Clerk Development personas shared with the other V4 live suites.
const PERSONAS = {
  owner: "user_3JhPbDuVSiPLuEA6Z8oo86c4Jmr", // OWNER of businessA + businessC
  staff: "user_3JhUSSDpL2bmzswoMoNM6RzDkyn", // STAFF of businessA
  otherOwner: "user_3JhPbugktYsiMOGIDxF40YwRzx7", // OWNER of businessB only
  admin: "user_3JhUR15hV88Uxb47ZHVVN3BY7xu", // platform admin JWT
};

// ── Fixtures ─────────────────────────────────────────────────────────────────

const id = (n: number) => `d5000009-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const FIX = {
  businessA: id(0x101), // OWNER owner, STAFF staff
  businessB: id(0x102), // OWNER otherOwner
  businessC: id(0x103), // OWNER owner — used for the suspension cases
};

const FIXTURE_BUSINESSES = [FIX.businessA, FIX.businessB, FIX.businessC];

const A = { can_buy: false, can_sell: true, status: "active" } as const;

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
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${testId.padEnd(11)} ${name}`);
  if (!condition && details) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(76)}\n  ${title}\n${"=".repeat(76)}`);
}

interface BusinessRow {
  id: string;
  name: string;
  can_buy: boolean;
  can_sell: boolean;
  status: string;
  legacy_clerk_id: string | null;
  created_at: string;
}

async function readBusiness(businessId: string): Promise<BusinessRow> {
  const { data, error } = await adminClient
    .from("businesses")
    .select("id, name, can_buy, can_sell, status, legacy_clerk_id, created_at")
    .eq("id", businessId)
    .single();
  if (error) throw new Error(`readBusiness(${businessId}): ${error.message}`);
  return data as BusinessRow;
}

interface WriteOutcome {
  code: string | null;
  rows: number;
  message: string;
}

/**
 * One UPDATE through the caller's own client.
 *
 * Two distinct denial shapes must be told apart:
 *   - guard rejection  → error.code === '42501' (row matched RLS, trigger raised)
 *   - RLS denial       → no error, rows === 0  (row never matched the policy)
 */
async function updateBusiness(
  client: SupabaseClient,
  businessId: string,
  patch: Record<string, unknown>
): Promise<WriteOutcome> {
  const { data, error } = await client.from("businesses").update(patch).eq("id", businessId).select("id");
  return {
    code: error?.code ?? null,
    rows: Array.isArray(data) ? data.length : 0,
    message: error?.message ?? "",
  };
}

async function insertMembership(
  client: SupabaseClient,
  businessId: string,
  userId: string,
  role: string
): Promise<WriteOutcome> {
  const { data, error } = await client
    .from("business_members")
    .insert({ business_id: businessId, user_id: userId, role })
    .select("id");
  return {
    code: error?.code ?? null,
    rows: Array.isArray(data) ? data.length : 0,
    message: error?.message ?? "",
  };
}

async function updateMembershipRole(
  client: SupabaseClient,
  businessId: string,
  userId: string,
  role: string
): Promise<WriteOutcome> {
  const { data, error } = await client
    .from("business_members")
    .update({ role })
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .select("role");
  return {
    code: error?.code ?? null,
    rows: Array.isArray(data) ? data.length : 0,
    message: error?.message ?? "",
  };
}

async function roleOf(businessId: string, userId: string): Promise<string | null> {
  const { data, error } = await adminClient
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`roleOf: ${error.message}`);
  return (data as { role: string } | null)?.role ?? null;
}

async function memberCount(businessId: string): Promise<number> {
  const { count, error } = await adminClient
    .from("business_members")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (error) throw new Error(`memberCount: ${error.message}`);
  return count ?? -1;
}

/** Platform/admin status change: the only path that may write `status`. */
async function setStatus(businessId: string, status: string): Promise<void> {
  const { error } = await adminClient.from("businesses").update({ status }).eq("id", businessId);
  if (error) throw new Error(`setStatus: ${error.message}`);
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
  section("CAT — guard trigger, function shape and policy surface");

  const triggers = liveSql<{ def: string }>(
    "SELECT pg_get_triggerdef(t.oid) AS def FROM pg_trigger t " +
      "WHERE t.tgrelid = 'public.businesses'::regclass AND NOT t.tgisinternal " +
      "AND t.tgname = 'trg_businesses_20_guard_client_writes'"
  );
  const def = triggers[0]?.def ?? "";
  assert(
    "CAT-01",
    "Column guard is installed as BEFORE UPDATE ON public.businesses (all columns)",
    triggers.length === 1 && /BEFORE UPDATE ON public\.businesses FOR EACH ROW/.test(def),
    def || "(trigger missing)"
  );

  const [fn] = liveSql<{ secdef: boolean; config: string | null; anon: boolean; auth: boolean }>(
    "SELECT p.prosecdef AS secdef, array_to_string(p.proconfig, ',') AS config, " +
      "has_function_privilege('anon', 'public.trigger_guard_business_client_writes()', 'EXECUTE') AS anon, " +
      "has_function_privilege('authenticated', 'public.trigger_guard_business_client_writes()', 'EXECUTE') AS auth " +
      "FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace " +
      "WHERE n.nspname = 'public' AND p.proname = 'trigger_guard_business_client_writes'"
  );
  assert(
    "CAT-02",
    "Guard function is SECURITY INVOKER, pinned search_path, not client-executable",
    fn?.secdef === false && fn?.config === "search_path=public" && fn?.anon === false && fn?.auth === false,
    JSON.stringify(fn)
  );

  const bizPolicies = liveSql<{ policyname: string; cmd: string; qual: string }>(
    "SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' " +
      "AND tablename = 'businesses' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')"
  );
  assert(
    "CAT-03",
    "businesses: exactly one write policy and it is OWNER-only UPDATE",
    bizPolicies.length === 1 &&
      bizPolicies[0].cmd === "UPDATE" &&
      bizPolicies[0].policyname === "businesses: owner can update business" &&
      /bm\.role = 'OWNER'/.test(bizPolicies[0].qual),
    JSON.stringify(bizPolicies)
  );

  const memberPolicies = liveSql<{ cmd: string }>(
    "SELECT cmd FROM pg_policies WHERE schemaname = 'public' " +
      "AND tablename = 'business_members' AND cmd <> 'SELECT'"
  );
  assert(
    "CAT-04",
    "business_members: still default-deny (no INSERT/UPDATE/DELETE policy)",
    memberPolicies.length === 0,
    JSON.stringify(memberPolicies)
  );
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  const { error: memErr } = await adminClient
    .from("business_members")
    .delete()
    .in("business_id", FIXTURE_BUSINESSES);
  if (memErr) console.error(`  cleanup business_members: ${memErr.message}`);

  const { error: bizErr } = await adminClient.from("businesses").delete().in("id", FIXTURE_BUSINESSES);
  if (bizErr) console.error(`  cleanup businesses: ${bizErr.message}`);

  for (const sessionId of activeClerkSessionIds.splice(0)) {
    try {
      await clerk.sessions.revokeSession(sessionId);
    } catch {
      // Session may already be gone.
    }
  }
}

async function seed(): Promise<void> {
  const { error: bizErr } = await adminClient.from("businesses").upsert([
    { id: FIX.businessA, name: "F9 Owner Business", can_buy: A.can_buy, can_sell: A.can_sell, status: A.status },
    { id: FIX.businessB, name: "F9 Other Business", can_buy: true, can_sell: false, status: A.status },
    { id: FIX.businessC, name: "F9 Suspended Business", can_buy: true, can_sell: true, status: A.status },
  ]);
  if (bizErr) throw new Error(`seed businesses: ${bizErr.message}`);

  const { error: memErr } = await adminClient.from("business_members").upsert(
    [
      { business_id: FIX.businessA, user_id: PERSONAS.owner, role: "OWNER" },
      { business_id: FIX.businessA, user_id: PERSONAS.staff, role: "STAFF" },
      { business_id: FIX.businessB, user_id: PERSONAS.otherOwner, role: "OWNER" },
      { business_id: FIX.businessC, user_id: PERSONAS.owner, role: "OWNER" },
    ],
    { onConflict: "business_id,user_id" }
  );
  if (memErr) throw new Error(`seed business_members: ${memErr.message}`);
}

// ── Suite ────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`  Target: ${env.supabaseUrl}`);
  await cleanup();
  await seed();

  catalogChecks();

  const owner = await getAuthenticatedClient(PERSONAS.owner);
  const staff = await getAuthenticatedClient(PERSONAS.staff);
  const otherOwner = await getAuthenticatedClient(PERSONAS.otherOwner);
  const admin = await getAuthenticatedClient(PERSONAS.admin);

  // ══════════════════════════════════════════════════════════════════════════
  section("ALLOW — legitimate OWNER business editing survives");
  // ══════════════════════════════════════════════════════════════════════════

  const rename = await updateBusiness(owner, FIX.businessA, { name: "F9 Owner Business Renamed" });
  assert(
    "ALLOW-01",
    "OWNER can rename their business (profile-safe column)",
    rename.code === null && rename.rows === 1,
    `${rename.code} rows=${rename.rows} ${rename.message}`
  );
  {
    const after = await readBusiness(FIX.businessA);
    assert(
      "ALLOW-02",
      "Rename persisted and no other column moved",
      after.name === "F9 Owner Business Renamed" &&
        after.can_buy === A.can_buy &&
        after.can_sell === A.can_sell &&
        after.status === A.status &&
        after.legacy_clerk_id === null,
      JSON.stringify(after)
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("OWN — OWNER cannot rewrite capabilities, status or identity");
  // ══════════════════════════════════════════════════════════════════════════

  const ownCases: Array<[string, string, Record<string, unknown>]> = [
    ["OWN-01", "OWNER cannot change can_buy", { can_buy: true }],
    ["OWN-02", "OWNER cannot change can_sell", { can_sell: false }],
    ["OWN-03", "OWNER cannot change status", { status: "suspended" }],
    ["OWN-04", "OWNER cannot change legacy_clerk_id", { legacy_clerk_id: PERSONAS.otherOwner }],
    ["OWN-05", "OWNER cannot change id (ownership key)", { id: id(0x1ff) }],
    ["OWN-06", "OWNER cannot change created_at", { created_at: "2000-01-01T00:00:00.000Z" }],
  ];
  const beforeOwn = await readBusiness(FIX.businessA);
  for (const [testId, name, patch] of ownCases) {
    // Re-read per case so an earlier (unexpectedly successful) write cannot
    // poison the comparison for a later one.
    const before = await readBusiness(FIX.businessA);
    const r = await updateBusiness(owner, FIX.businessA, patch);
    const after = await readBusiness(FIX.businessA);
    assert(
      testId,
      name,
      r.code === "42501" &&
        after.name === before.name &&
        after.id === before.id &&
        after.can_buy === before.can_buy &&
        after.can_sell === before.can_sell &&
        after.status === before.status &&
        after.legacy_clerk_id === before.legacy_clerk_id &&
        after.created_at === before.created_at,
      `${r.code} rows=${r.rows} ${r.message} | before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
    );
  }
  assert(
    "OWN-00",
    "Precondition: businessA untouched by the OWN batch",
    JSON.stringify(await readBusiness(FIX.businessA)) === JSON.stringify(beforeOwn),
    JSON.stringify(await readBusiness(FIX.businessA))
  );

  // ══════════════════════════════════════════════════════════════════════════
  section("STAFF — no owner-only mutation rights");
  // ══════════════════════════════════════════════════════════════════════════

  {
    const before = await readBusiness(FIX.businessA);
    const renameAttempt = await updateBusiness(staff, FIX.businessA, { name: "Staff Rename" });
    assert(
      "STAFF-01",
      "STAFF cannot rename the business (no UPDATE policy)",
      renameAttempt.code === null && renameAttempt.rows === 0,
      `${renameAttempt.code} rows=${renameAttempt.rows} ${renameAttempt.message}`
    );

    const statusAttempt = await updateBusiness(staff, FIX.businessA, { status: "suspended" });
    const capAttempt = await updateBusiness(staff, FIX.businessA, { can_buy: true, can_sell: false });
    const after = await readBusiness(FIX.businessA);
    assert(
      "STAFF-02",
      "STAFF cannot change status or capabilities",
      statusAttempt.rows === 0 &&
        capAttempt.rows === 0 &&
        after.name === before.name &&
        after.can_buy === before.can_buy &&
        after.can_sell === before.can_sell &&
        after.status === before.status,
      `status=${statusAttempt.code}/${statusAttempt.rows} caps=${capAttempt.code}/${capAttempt.rows}`
    );

    const promote = await updateMembershipRole(staff, FIX.businessA, PERSONAS.staff, "OWNER");
    assert(
      "STAFF-03",
      "STAFF cannot promote itself to OWNER",
      promote.rows === 0 && (await roleOf(FIX.businessA, PERSONAS.staff)) === "STAFF",
      `rows=${promote.rows} role=${await roleOf(FIX.businessA, PERSONAS.staff)}`
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("CROSS — another business's OWNER cannot mutate this business");
  // ══════════════════════════════════════════════════════════════════════════

  {
    const before = await readBusiness(FIX.businessA);
    const renameAttempt = await updateBusiness(otherOwner, FIX.businessA, { name: "Hijacked Name" });
    assert(
      "CROSS-01",
      "A foreign business's OWNER cannot rename this business",
      renameAttempt.code === null && renameAttempt.rows === 0,
      `${renameAttempt.code} rows=${renameAttempt.rows}`
    );

    const statusAttempt = await updateBusiness(otherOwner, FIX.businessA, { status: "revoked" });
    const after = await readBusiness(FIX.businessA);
    assert(
      "CROSS-02",
      "A foreign business's OWNER cannot change this business's status",
      statusAttempt.rows === 0 && after.status === before.status && after.name === before.name,
      `rows=${statusAttempt.rows} status=${after.status}`
    );

    const beforeMembers = await memberCount(FIX.businessA);
    const add = await insertMembership(otherOwner, FIX.businessA, PERSONAS.otherOwner, "OWNER");
    assert(
      "CROSS-03",
      "A foreign business's OWNER cannot add a membership to this business",
      add.code === "42501" && (await memberCount(FIX.businessA)) === beforeMembers,
      `${add.code} rows=${add.rows} ${add.message}`
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("MEMB — an OWNER cannot add ownership to another business");
  // ══════════════════════════════════════════════════════════════════════════

  {
    const before = await memberCount(FIX.businessB);
    const add = await insertMembership(owner, FIX.businessB, PERSONAS.owner, "OWNER");
    assert(
      "MEMB-01",
      "OWNER of businessA cannot insert an OWNER membership into businessB",
      add.code === "42501" && (await memberCount(FIX.businessB)) === before,
      `${add.code} rows=${add.rows} ${add.message}`
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("SUSP — a suspended/revoked business stays that way for its OWNER");
  // ══════════════════════════════════════════════════════════════════════════

  await setStatus(FIX.businessC, "suspended");
  assert("SUSP-01", "Platform suspends businessC (service_role)", (await readBusiness(FIX.businessC)).status === "suspended");

  {
    const unsuspend = await updateBusiness(owner, FIX.businessC, { status: "active" });
    assert(
      "SUSP-02",
      "OWNER cannot self-unsuspend a suspended business",
      unsuspend.code === "42501" && (await readBusiness(FIX.businessC)).status === "suspended",
      `${unsuspend.code} ${unsuspend.message}`
    );

    const caps = await updateBusiness(owner, FIX.businessC, { can_buy: false, can_sell: false });
    const afterCaps = await readBusiness(FIX.businessC);
    assert(
      "SUSP-03",
      "OWNER cannot change capabilities on a suspended business",
      caps.code === "42501" && afterCaps.can_buy === true && afterCaps.can_sell === true,
      `${caps.code} ${caps.message}`
    );
  }

  await setStatus(FIX.businessC, "revoked");
  {
    const restore = await updateBusiness(owner, FIX.businessC, { status: "active" });
    assert(
      "SUSP-04",
      "OWNER cannot un-suspend a revoked business",
      restore.code === "42501" && (await readBusiness(FIX.businessC)).status === "revoked",
      `${restore.code} ${restore.message}`
    );
  }

  await setStatus(FIX.businessC, "active");
  assert(
    "SUSP-05",
    "Platform (service_role) can still suspend and restore — admin mechanism valid",
    (await readBusiness(FIX.businessC)).status === "active"
  );

  // ══════════════════════════════════════════════════════════════════════════
  section("ANON — anonymous cannot mutate");
  // ══════════════════════════════════════════════════════════════════════════

  {
    const before = await readBusiness(FIX.businessA);
    const renameAttempt = await updateBusiness(anonClient, FIX.businessA, { name: "Anon Rename" });
    assert(
      "ANON-01",
      "anonymous cannot rename a business",
      renameAttempt.code === null && renameAttempt.rows === 0,
      `${renameAttempt.code} rows=${renameAttempt.rows}`
    );

    const statusAttempt = await updateBusiness(anonClient, FIX.businessA, { status: "suspended" });
    const after = await readBusiness(FIX.businessA);
    assert(
      "ANON-02",
      "anonymous cannot change status",
      statusAttempt.rows === 0 && after.status === before.status && after.name === before.name,
      `rows=${statusAttempt.rows}`
    );

    const inserted = await anonClient
      .from("businesses")
      .insert({ name: "Anon Injected", can_buy: true, can_sell: true })
      .select("id");
    assert(
      "ANON-03",
      "anonymous cannot insert a business",
      inserted.error?.code === "42501",
      `${inserted.error?.code} ${inserted.error?.message ?? "insert succeeded"}`
    );

    const deleted = await anonClient.from("businesses").delete().eq("id", FIX.businessA).select("id");
    assert(
      "ANON-04",
      "anonymous cannot delete a business",
      (deleted.data ?? []).length === 0 && Boolean(await readBusiness(FIX.businessA)),
      `rows=${(deleted.data ?? []).length} ${deleted.error?.message ?? ""}`
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("PLAT — platform path intact, admin JWT unchanged");
  // ══════════════════════════════════════════════════════════════════════════

  {
    const { error } = await adminClient
      .from("businesses")
      .update({ can_buy: true, can_sell: false, status: "suspended" })
      .eq("id", FIX.businessA);
    const elevated = await readBusiness(FIX.businessA);
    assert(
      "PLAT-01",
      "service_role can still set capabilities and status (platform/admin path)",
      !error && elevated.can_buy === true && elevated.can_sell === false && elevated.status === "suspended",
      error?.message ?? JSON.stringify(elevated)
    );

    const { error: restoreErr } = await adminClient
      .from("businesses")
      .update({ can_buy: A.can_buy, can_sell: A.can_sell, status: A.status })
      .eq("id", FIX.businessA);
    const restored = await readBusiness(FIX.businessA);
    assert(
      "PLAT-01b",
      "service_role restores businessA to its original capabilities and status",
      !restoreErr && restored.can_buy === A.can_buy && restored.can_sell === A.can_sell && restored.status === A.status,
      restoreErr?.message ?? JSON.stringify(restored)
    );

    const adminAttempt = await updateBusiness(admin, FIX.businessA, { status: "revoked" });
    assert(
      "PLAT-02",
      "admin JWT has no direct UPDATE on a business it does not own (unchanged)",
      adminAttempt.code === null && adminAttempt.rows === 0 && (await readBusiness(FIX.businessA)).status === A.status,
      `${adminAttempt.code} rows=${adminAttempt.rows}`
    );
  }
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
