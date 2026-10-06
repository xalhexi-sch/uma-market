/**
 * UMA Market V4 — Focused Live Security-Test Verification: PDP Add-to-Cart write contract
 *
 * SAFETY RULES:
 *   1. Credentials loaded exclusively from .env.security-test.local.
 *   2. Aborts (exit 2) unless pointing at dedicated security-test project.
 *   3. Uses Clerk Development instance key to mint authenticated test sessions.
 *   4. Deterministic UUIDs prefixed "d4000004-". Cleaned up in finally block.
 *
 * VERIFIES the database contract that addToBusinessCart (src/platform/cart-actions.ts)
 * relies on, using real Clerk JWTs against RLS:
 *   1. Root cause: PostgREST upsert onConflict cannot target the PARTIAL cart_items
 *      unique indexes (V4 and legacy targets both fail with 42P10).
 *   2. Duplicate (business_id, product_id) insert fails with 23505 (retry trigger).
 *   3. Compare-and-swap update with a stale quantity changes 0 rows; a current one
 *      changes exactly 1 row (increment path).
 *   4. The same product can sit in two businesses' carts without conflict.
 *   5. RLS rejects cart writes for a suspended business, a SELL-only business and a
 *      non-member business.
 *
 * The end-to-end server action path (PDP → Add to Cart → checkout) is covered by
 * tests/browser/v4-pdp-add-to-cart.spec.ts.
 *
 * HOW TO RUN:
 *   npx tsx scripts/verify-v4-pdp-cart-live.ts
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/nextjs/server";
import { assertClerkDevelopmentKey, loadSecurityTestEnv } from "./lib/safety-guard";

// ── Environment Guard ────────────────────────────────────────────────────────

const env = loadSecurityTestEnv("verify-v4-pdp-cart-live");
assertClerkDevelopmentKey("verify-v4-pdp-cart-live", env.clerkSecretKey);

const adminClient: SupabaseClient = createClient(env.supabaseUrl, env.secretKey, {
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

// ── Personas & Deterministic Fixture IDs ──────────────────────────────────────

const PERSONAS = {
  buyerA: "user_3JhPbugktYsiMOGIDxF40YwRzx7", // role: business
  farmerA: "user_3JhPbDuVSiPLuEA6Z8oo86c4Jmr", // role: farmer
};

const FIXTURES = {
  categoryId: "d4000004-0000-0000-0000-000000000001",
  product: "d4000004-0000-0000-0000-000000000002",

  businessA: "d4000004-0000-0000-0000-000000000010", // buyerA OWNER, can_buy
  businessB: "d4000004-0000-0000-0000-000000000020", // buyerA STAFF, can_buy
  businessSuspended: "d4000004-0000-0000-0000-000000000030", // buyerA STAFF, suspended
  businessSellOnly: "d4000004-0000-0000-0000-000000000040", // buyerA STAFF, can_buy false
  businessForeign: "d4000004-0000-0000-0000-000000000050", // buyerA not a member
};

const ALL_BUSINESSES = [
  FIXTURES.businessA,
  FIXTURES.businessB,
  FIXTURES.businessSuspended,
  FIXTURES.businessSellOnly,
  FIXTURES.businessForeign,
];

// ── Test Infrastructure ──────────────────────────────────────────────────────

interface TestResult {
  id: string;
  passed: boolean;
}

const results: TestResult[] = [];

function assert(id: string, name: string, condition: boolean, details: string): boolean {
  results.push({ id, passed: condition });
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${id.padEnd(16)} ${name}`);
  if (!condition) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(76)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(76));
}

// ── Cleanup / Seed ───────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  console.log("\n  [Cleanup] Removing test fixtures...");
  await adminClient.from("cart_items").delete().eq("product_id", FIXTURES.product);
  await adminClient.from("business_members").delete().in("business_id", ALL_BUSINESSES);
  await adminClient.from("businesses").delete().in("id", ALL_BUSINESSES);
  await adminClient.from("products").delete().eq("id", FIXTURES.product);
  await adminClient.from("categories").delete().eq("id", FIXTURES.categoryId);

  for (const sessionId of activeClerkSessionIds) {
    try {
      await clerk.sessions.revokeSession(sessionId);
    } catch {
      /* session might already be closed */
    }
  }
  activeClerkSessionIds.length = 0;
  console.log("  [Cleanup] Finished.");
}

async function mustSucceed(label: string, op: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await op;
  if (error) throw new Error(`[Seed] ${label} failed: ${error.message}`);
}

async function seed(): Promise<void> {
  console.log("  [Seed] Setting up test fixtures...");

  await mustSucceed(
    "category",
    adminClient.from("categories").upsert({
      id: FIXTURES.categoryId,
      name: "Live PDP Cart Test Category",
      slug: "live-pdp-cart-test-category",
      description: "Category for V4 PDP cart live verification",
      icon: "ri-shopping-cart-line",
    })
  );

  await mustSucceed(
    "product",
    adminClient.from("products").upsert({
      id: FIXTURES.product,
      farmer_clerk_id: PERSONAS.farmerA,
      category_id: FIXTURES.categoryId,
      name: "PDP Cart Live Test Tomatoes",
      description: "Fixture",
      price_per_unit: 120,
      unit: "kg",
      quantity_available: 50,
      min_order_quantity: 2,
      status: "active",
      moderation_status: "approved",
    })
  );

  await mustSucceed(
    "businesses",
    adminClient.from("businesses").upsert([
      { id: FIXTURES.businessA, name: "PDP Live Buyer A", can_buy: true, can_sell: false, status: "active" },
      { id: FIXTURES.businessB, name: "PDP Live Buyer B", can_buy: true, can_sell: false, status: "active" },
      { id: FIXTURES.businessSuspended, name: "PDP Live Suspended", can_buy: true, can_sell: false, status: "suspended" },
      { id: FIXTURES.businessSellOnly, name: "PDP Live Sell Only", can_buy: false, can_sell: true, status: "active" },
      { id: FIXTURES.businessForeign, name: "PDP Live Foreign", can_buy: true, can_sell: false, status: "active" },
    ])
  );

  await mustSucceed(
    "memberships",
    adminClient.from("business_members").upsert([
      { business_id: FIXTURES.businessA, user_id: PERSONAS.buyerA, role: "OWNER" },
      { business_id: FIXTURES.businessB, user_id: PERSONAS.buyerA, role: "STAFF" },
      { business_id: FIXTURES.businessSuspended, user_id: PERSONAS.buyerA, role: "STAFF" },
      { business_id: FIXTURES.businessSellOnly, user_id: PERSONAS.buyerA, role: "STAFF" },
      { business_id: FIXTURES.businessForeign, user_id: PERSONAS.farmerA, role: "OWNER" },
    ])
  );

  console.log("  [Seed] Fixtures ready.");
}

// ── Test Runner ──────────────────────────────────────────────────────────────

function row(businessId: string, quantity: number) {
  return {
    business_id: businessId,
    business_clerk_id: PERSONAS.buyerA,
    product_id: FIXTURES.product,
    quantity,
  };
}

async function runLiveTests(): Promise<void> {
  section("UMA V4 PDP Add-to-Cart — Live Write-Contract Verification");

  await cleanup();
  await seed();

  try {
    const buyer = await getAuthenticatedClient(PERSONAS.buyerA);

    // ── 1. Root cause ────────────────────────────────────────────────────────
    section("1. Root cause: upsert onConflict vs partial unique indexes");

    const { error: v4UpsertErr } = await buyer
      .from("cart_items")
      .upsert(row(FIXTURES.businessA, 2), { onConflict: "business_id,product_id" });
    assert(
      "PDP-ROOT-01",
      "V4 upsert onConflict(business_id,product_id) fails with 42P10",
      v4UpsertErr?.code === "42P10",
      `code=${v4UpsertErr?.code ?? "none"} message=${v4UpsertErr?.message ?? "none"}`
    );

    const { error: legacyUpsertErr } = await buyer
      .from("cart_items")
      .upsert(
        { business_clerk_id: PERSONAS.buyerA, product_id: FIXTURES.product, quantity: 2 },
        { onConflict: "business_clerk_id,product_id" }
      );
    assert(
      "PDP-ROOT-02",
      "Legacy upsert onConflict(business_clerk_id,product_id) fails with 42P10",
      legacyUpsertErr?.code === "42P10",
      `code=${legacyUpsertErr?.code ?? "none"} message=${legacyUpsertErr?.message ?? "none"}`
    );

    const { count: rootRows } = await adminClient
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", FIXTURES.product);
    assert("PDP-ROOT-03", "Failed upserts wrote no rows", rootRows === 0, `rows=${rootRows}`);

    // ── 2. Insert + duplicate detection ──────────────────────────────────────
    section("2. Insert path and 23505 retry trigger");

    const { data: inserted, error: insertErr } = await buyer
      .from("cart_items")
      .insert(row(FIXTURES.businessA, 2))
      .select("id, business_id, quantity")
      .maybeSingle();
    assert(
      "PDP-INS-01",
      "Member of BUY business inserts cart row with business_id set",
      insertErr === null && inserted?.business_id === FIXTURES.businessA && inserted?.quantity === 2,
      insertErr ? `Error: ${insertErr.message}` : JSON.stringify(inserted)
    );

    const { error: dupErr } = await buyer.from("cart_items").insert(row(FIXTURES.businessA, 2));
    assert(
      "PDP-INS-02",
      "Duplicate (business_id, product_id) insert fails with 23505",
      dupErr?.code === "23505",
      `code=${dupErr?.code ?? "none"}`
    );

    // ── 3. Compare-and-swap increment ────────────────────────────────────────
    section("3. Compare-and-swap increment");

    const { data: staleUpdate, error: staleErr } = await buyer
      .from("cart_items")
      .update({ quantity: 99 })
      .eq("id", inserted?.id ?? "")
      .eq("business_id", FIXTURES.businessA)
      .eq("quantity", 7)
      .select("id");
    assert(
      "PDP-CAS-01",
      "CAS update with stale quantity changes 0 rows",
      staleErr === null && (staleUpdate ?? []).length === 0,
      staleErr ? `Error: ${staleErr.message}` : `rows=${staleUpdate?.length}`
    );

    const { data: casUpdate, error: casErr } = await buyer
      .from("cart_items")
      .update({ quantity: 4 })
      .eq("id", inserted?.id ?? "")
      .eq("business_id", FIXTURES.businessA)
      .eq("quantity", 2)
      .select("id, quantity");
    assert(
      "PDP-CAS-02",
      "CAS update with current quantity changes exactly 1 row (2 → 4)",
      casErr === null && (casUpdate ?? []).length === 1 && casUpdate?.[0].quantity === 4,
      casErr ? `Error: ${casErr.message}` : JSON.stringify(casUpdate)
    );

    // ── 4. Business isolation ────────────────────────────────────────────────
    section("4. Same product in two businesses");

    const { error: otherBizErr } = await buyer.from("cart_items").insert(row(FIXTURES.businessB, 3));
    assert(
      "PDP-ISO-01",
      "Same product inserts into Business B cart without conflicting with Business A",
      otherBizErr === null,
      otherBizErr ? `Error: ${otherBizErr.message}` : "inserted"
    );

    const { data: bothRows } = await adminClient
      .from("cart_items")
      .select("business_id, quantity")
      .eq("product_id", FIXTURES.product)
      .order("business_id");
    assert(
      "PDP-ISO-02",
      "Two separate rows exist: A=4, B=3",
      (bothRows ?? []).length === 2 &&
        bothRows?.find((r) => r.business_id === FIXTURES.businessA)?.quantity === 4 &&
        bothRows?.find((r) => r.business_id === FIXTURES.businessB)?.quantity === 3,
      JSON.stringify(bothRows)
    );

    // ── 5. RLS denials ───────────────────────────────────────────────────────
    section("5. RLS denials for ineligible businesses");

    for (const [id, label, businessId] of [
      ["PDP-RLS-01", "suspended business", FIXTURES.businessSuspended],
      ["PDP-RLS-02", "SELL-only business", FIXTURES.businessSellOnly],
      ["PDP-RLS-03", "non-member business", FIXTURES.businessForeign],
    ] as const) {
      const { error } = await buyer.from("cart_items").insert(row(businessId, 2));
      const { count } = await adminClient
        .from("cart_items")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId);
      assert(
        id,
        `Cart INSERT into ${label} is rejected and writes nothing`,
        error !== null && count === 0,
        error ? `rows=${count}` : `DANGER: insert into ${label} succeeded`
      );
    }

    const { count: legacyNullRows } = await adminClient
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", FIXTURES.product)
      .is("business_id", null);
    assert(
      "PDP-NUL-01",
      "No cart row with business_id NULL was created for the fixture product",
      legacyNullRows === 0,
      `null rows=${legacyNullRows}`
    );
  } finally {
    await cleanup();
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n${"=".repeat(76)}`);
  console.log(`  LIVE TEST RESULTS: ${passed} PASSED, ${failed} FAILED (Total: ${results.length})`);
  console.log("=".repeat(76));
  if (failed > 0) process.exit(1);
}

runLiveTests().catch((err) => {
  console.error("\nFATAL: Live verification script failed with unhandled exception:", err);
  process.exit(1);
});
