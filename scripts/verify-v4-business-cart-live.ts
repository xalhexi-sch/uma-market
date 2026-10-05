/**
 * UMA Market V4 — Focused Live Security-Test Verification: Business Cart Ownership & RLS
 *
 * SAFETY RULES:
 *   1. Credentials loaded exclusively from .env.security-test.local.
 *   2. Aborts (exit 2) unless pointing at dedicated security-test project.
 *   3. Uses Clerk Development instance key to mint authenticated test sessions.
 *   4. Deterministic UUIDs prefixed "d4000001-". Cleaned up in finally block.
 *
 * VERIFIES:
 *   1. OWNER of Business A can read/write Business A's V4 cart.
 *   2. STAFF of Business A can read/write Business A's V4 cart.
 *   3. Member of Business A cannot access Business B's cart.
 *   4. Non-member cannot access Business A's cart.
 *   5. A SELL-only business cannot mutate a buyer cart.
 *   6. Switching active business cannot expose another business's cart.
 *   7. Existing legacy V2 cart behavior remains intact during the migration window.
 *
 * HOW TO RUN:
 *   npx tsx scripts/verify-v4-business-cart-live.ts
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/nextjs/server";
import { assertClerkDevelopmentKey, loadSecurityTestEnv } from "./lib/safety-guard";

// ── Environment Guard ────────────────────────────────────────────────────────

const env = loadSecurityTestEnv("verify-v4-business-cart-live");
assertClerkDevelopmentKey("verify-v4-business-cart-live", env.clerkSecretKey);

const supabaseUrl = env.supabaseUrl;
const supabaseSecretKey = env.secretKey;
const supabaseAnonKey = env.anonKey;

// Admin client: service_role for seeding and verifying state
const adminClient: SupabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Anon client: unauthenticated baseline
const anonClient: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
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
};

const FIXTURES = {
  categoryId: "d4000001-0000-0000-0000-000000000001",
  product1:   "d4000001-0000-0000-0000-000000000002",
  product2:   "d4000001-0000-0000-0000-000000000003",

  // Businesses
  businessA:  "d4000001-0000-0000-0000-000000000010", // Buyer A (can_buy: true)
  businessB:  "d4000001-0000-0000-0000-000000000020", // Buyer B (can_buy: true)
  businessC:  "d4000001-0000-0000-0000-000000000030", // Secondary business for buyerA (can_buy: true)
  businessS:  "d4000001-0000-0000-0000-000000000040", // Sell-only farm (can_buy: false, can_sell: true)

  // Cart item IDs
  cartA1:     "d4000001-0000-0000-0000-000000000101",
  cartA2:     "d4000001-0000-0000-0000-000000000102",
  cartB1:     "d4000001-0000-0000-0000-000000000103",
  cartC1:     "d4000001-0000-0000-0000-000000000104",
  cartV2:     "d4000001-0000-0000-0000-000000000105",
};

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

  // Delete cart items
  await adminClient.from("cart_items").delete().in("id", [
    FIXTURES.cartA1,
    FIXTURES.cartA2,
    FIXTURES.cartB1,
    FIXTURES.cartC1,
    FIXTURES.cartV2,
  ]);

  // Delete memberships
  await adminClient.from("business_members").delete().in("business_id", [
    FIXTURES.businessA,
    FIXTURES.businessB,
    FIXTURES.businessC,
    FIXTURES.businessS,
  ]);

  // Delete businesses
  await adminClient.from("businesses").delete().in("id", [
    FIXTURES.businessA,
    FIXTURES.businessB,
    FIXTURES.businessC,
    FIXTURES.businessS,
  ]);

  // Delete products & category
  await adminClient.from("products").delete().in("id", [FIXTURES.product1, FIXTURES.product2]);
  await adminClient.from("categories").delete().eq("id", FIXTURES.categoryId);

  // Revoke any minted Clerk sessions
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

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log("  [Seed] Setting up test fixtures...");

  // Category
  await adminClient.from("categories").upsert({
    id: FIXTURES.categoryId,
    name: "Live Cart Test Category",
    slug: "live-cart-test-category",
    description: "Category for V4 cart live verification",
    icon: "ri-shopping-cart-line",
  });

  // Products
  await adminClient.from("products").upsert([
    {
      id: FIXTURES.product1,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      category_id: FIXTURES.categoryId,
      name: "Cart Test Benguet Strawberries",
      description: "Fresh strawberries",
      price_per_unit: 250.0,
      unit: "kg",
      quantity_available: 100,
      min_order_quantity: 2,
      status: "active",
      moderation_status: "approved",
    },
    {
      id: FIXTURES.product2,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      category_id: FIXTURES.categoryId,
      name: "Cart Test Mountain Carrots",
      description: "Crisp carrots",
      price_per_unit: 80.0,
      unit: "kg",
      quantity_available: 200,
      min_order_quantity: 5,
      status: "active",
      moderation_status: "approved",
    },
  ]);

  // Businesses
  await adminClient.from("businesses").upsert([
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
      id: FIXTURES.businessC,
      name: "Live Test Market C",
      can_buy: true,
      can_sell: false,
      status: "active",
    },
    {
      id: FIXTURES.businessS,
      name: "Live Test Producer S (Sell Only)",
      can_buy: false,
      can_sell: true,
      status: "active",
    },
  ]);

  // Memberships:
  // - buyerA is OWNER of Business A, and STAFF of Business C
  // - buyerB is STAFF of Business A
  // - farmerB is OWNER of Business B (non-member of A)
  // - farmerA is OWNER of Business S (sell-only)
  await adminClient.from("business_members").upsert([
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
      business_id: FIXTURES.businessC,
      user_id: PERSONAS.buyerA.clerkId,
      role: "STAFF",
    },
    {
      business_id: FIXTURES.businessS,
      user_id: PERSONAS.farmerA.clerkId,
      role: "OWNER",
    },
  ]);

  console.log("  [Seed] Fixtures ready.");
}

// ── Test Runner ──────────────────────────────────────────────────────────────

async function runLiveTests(): Promise<void> {
  section("UMA V4 Business Cart — Live Security-Test Verification");

  await cleanup();
  await seed();

  try {
    // Obtain live authenticated clients with real Clerk JWTs
    console.log("  [Auth] Minting test Clerk sessions...");
    const clientBuyerA = await getAuthenticatedClient(PERSONAS.buyerA.clerkId);
    const clientBuyerB = await getAuthenticatedClient(PERSONAS.buyerB.clerkId);
    const clientFarmerA = await getAuthenticatedClient(PERSONAS.farmerA.clerkId);
    const clientFarmerB = await getAuthenticatedClient(PERSONAS.farmerB.clerkId);
    console.log("  [Auth] Sessions active.");

    // ──────────────────────────────────────────────────────────────────────────
    // 1. OWNER of Business A can read/write Business A's V4 cart
    // ──────────────────────────────────────────────────────────────────────────
    section("1. OWNER Read/Write in Business A Cart");

    const { data: ownerInsert, error: ownerInsertErr } = await clientBuyerA
      .from("cart_items")
      .insert({
        id: FIXTURES.cartA1,
        business_id: FIXTURES.businessA,
        business_clerk_id: PERSONAS.buyerA.clerkId,
        product_id: FIXTURES.product1,
        quantity: 10,
      })
      .select()
      .maybeSingle();

    assert(
      "LIVE-OWN-01",
      "OWNER of Business A can INSERT item into Business A's cart",
      ownerInsertErr === null && ownerInsert?.id === FIXTURES.cartA1,
      ownerInsertErr ? `Error: ${ownerInsertErr.message}` : `Inserted id=${ownerInsert?.id}`
    );

    const { data: ownerSelect, error: ownerSelectErr } = await clientBuyerA
      .from("cart_items")
      .select("id, business_id, quantity")
      .eq("business_id", FIXTURES.businessA);

    assert(
      "LIVE-OWN-02",
      "OWNER of Business A can SELECT items in Business A's cart",
      ownerSelectErr === null && (ownerSelect ?? []).some((i) => i.id === FIXTURES.cartA1),
      ownerSelectErr ? `Error: ${ownerSelectErr.message}` : `Found ${ownerSelect?.length} item(s)`
    );

    const { error: ownerUpdateErr } = await clientBuyerA
      .from("cart_items")
      .update({ quantity: 15 })
      .eq("id", FIXTURES.cartA1)
      .eq("business_id", FIXTURES.businessA);

    assert(
      "LIVE-OWN-03",
      "OWNER of Business A can UPDATE quantity in Business A's cart",
      ownerUpdateErr === null,
      ownerUpdateErr ? `Error: ${ownerUpdateErr.message}` : "Updated quantity to 15"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // 2. STAFF of Business A can read/write Business A's V4 cart
    // ──────────────────────────────────────────────────────────────────────────
    section("2. STAFF Read/Write in Business A Cart");

    const { data: staffSelect, error: staffSelectErr } = await clientBuyerB
      .from("cart_items")
      .select("id, business_id, quantity")
      .eq("business_id", FIXTURES.businessA);

    assert(
      "LIVE-STF-01",
      "STAFF of Business A can SELECT items from Business A's cart",
      staffSelectErr === null && (staffSelect ?? []).some((i) => i.id === FIXTURES.cartA1),
      staffSelectErr ? `Error: ${staffSelectErr.message}` : `Staff saw ${staffSelect?.length} item(s)`
    );

    const { data: staffInsert, error: staffInsertErr } = await clientBuyerB
      .from("cart_items")
      .insert({
        id: FIXTURES.cartA2,
        business_id: FIXTURES.businessA,
        business_clerk_id: PERSONAS.buyerB.clerkId,
        product_id: FIXTURES.product2,
        quantity: 25,
      })
      .select()
      .maybeSingle();

    assert(
      "LIVE-STF-02",
      "STAFF of Business A can INSERT new item into Business A's cart",
      staffInsertErr === null && staffInsert?.id === FIXTURES.cartA2,
      staffInsertErr ? `Error: ${staffInsertErr.message}` : `Staff inserted id=${staffInsert?.id}`
    );

    const { error: staffUpdateErr } = await clientBuyerB
      .from("cart_items")
      .update({ quantity: 30 })
      .eq("id", FIXTURES.cartA2)
      .eq("business_id", FIXTURES.businessA);

    assert(
      "LIVE-STF-03",
      "STAFF of Business A can UPDATE item in Business A's cart",
      staffUpdateErr === null,
      staffUpdateErr ? `Error: ${staffUpdateErr.message}` : "Staff updated quantity to 30"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Member of Business A cannot access Business B's cart
    // ──────────────────────────────────────────────────────────────────────────
    section("3. Cross-Business Cart Boundary (Business A member -> Business B cart)");

    // Seed an item in Business B's cart using adminClient
    await adminClient.from("cart_items").insert({
      id: FIXTURES.cartB1,
      business_id: FIXTURES.businessB,
      business_clerk_id: PERSONAS.farmerB.clerkId,
      product_id: FIXTURES.product1,
      quantity: 5,
    });

    const { data: crossRead, error: crossReadErr } = await clientBuyerA
      .from("cart_items")
      .select("id, business_id")
      .eq("business_id", FIXTURES.businessB);

    assert(
      "LIVE-XBI-01",
      "Member of Business A receives 0 rows when attempting to SELECT Business B's cart",
      crossReadErr === null && (crossRead ?? []).length === 0,
      `Rows returned: ${crossRead?.length ?? 0}`
    );

    const { data: crossInsert, error: crossInsertErr } = await clientBuyerA
      .from("cart_items")
      .insert({
        business_id: FIXTURES.businessB,
        business_clerk_id: PERSONAS.buyerA.clerkId,
        product_id: FIXTURES.product2,
        quantity: 99,
      })
      .select();

    assert(
      "LIVE-XBI-02",
      "Member of Business A is rejected (RLS WITH CHECK) when attempting to INSERT into Business B cart",
      crossInsertErr !== null && !crossInsert,
      crossInsertErr ? `Correctly rejected: ${crossInsertErr.message}` : "DANGER: Cross-business insert succeeded!"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Non-member cannot access Business A's cart
    // ──────────────────────────────────────────────────────────────────────────
    section("4. Non-Member Cart Rejection");

    const { data: nonMemberRead } = await clientFarmerB
      .from("cart_items")
      .select("id, business_id")
      .eq("business_id", FIXTURES.businessA);

    assert(
      "LIVE-NON-01",
      "Non-member of Business A receives 0 rows on SELECT",
      (nonMemberRead ?? []).length === 0,
      `Non-member rows returned: ${nonMemberRead?.length ?? 0}`
    );

    const { error: nonMemberInsertErr } = await clientFarmerB
      .from("cart_items")
      .insert({
        business_id: FIXTURES.businessA,
        business_clerk_id: PERSONAS.farmerB.clerkId,
        product_id: FIXTURES.product1,
        quantity: 50,
      });

    assert(
      "LIVE-NON-02",
      "Non-member of Business A is rejected on INSERT into Business A cart",
      nonMemberInsertErr !== null,
      nonMemberInsertErr ? `Rejected: ${nonMemberInsertErr.message}` : "DANGER: Non-member insert succeeded!"
    );

    const { data: anonRead } = await anonClient
      .from("cart_items")
      .select("id, business_id")
      .eq("business_id", FIXTURES.businessA);

    assert(
      "LIVE-NON-03",
      "Anonymous client receives 0 rows from cart_items",
      (anonRead ?? []).length === 0,
      `Anon rows returned: ${anonRead?.length ?? 0}`
    );

    // ──────────────────────────────────────────────────────────────────────────
    // 5. A SELL-only business cannot mutate a buyer cart
    // ──────────────────────────────────────────────────────────────────────────
    section("5. SELL-Only Business (can_buy = false) Cannot Mutate Cart");

    const { error: sellOnlyInsertErr } = await clientFarmerA
      .from("cart_items")
      .insert({
        business_id: FIXTURES.businessS,
        business_clerk_id: PERSONAS.farmerA.clerkId,
        product_id: FIXTURES.product1,
        quantity: 10,
      });

    assert(
      "LIVE-CAP-01",
      "Business with can_buy = false is rejected by RLS on cart INSERT",
      sellOnlyInsertErr !== null,
      sellOnlyInsertErr ? `Correctly rejected: ${sellOnlyInsertErr.message}` : "DANGER: Sell-only business inserted cart item!"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Switching active business cannot expose another business's cart
    // ──────────────────────────────────────────────────────────────────────────
    section("6. Multi-Business User Isolation on Business Switch");

    // buyerA is member of Business A and Business C.
    // Insert an item into Business C
    await adminClient.from("cart_items").insert({
      id: FIXTURES.cartC1,
      business_id: FIXTURES.businessC,
      business_clerk_id: PERSONAS.buyerA.clerkId,
      product_id: FIXTURES.product2,
      quantity: 100,
    });

    const { data: cartContextA } = await clientBuyerA
      .from("cart_items")
      .select("id, business_id, quantity")
      .eq("business_id", FIXTURES.businessA);

    const { data: cartContextC } = await clientBuyerA
      .from("cart_items")
      .select("id, business_id, quantity")
      .eq("business_id", FIXTURES.businessC);

    assert(
      "LIVE-SW-01",
      "Querying Business A cart returns ONLY Business A items (does not leak Business C)",
      (cartContextA ?? []).length >= 2 &&
        (cartContextA ?? []).every((i) => i.business_id === FIXTURES.businessA),
      `Business A returned ${cartContextA?.length} item(s), all matching businessA`
    );

    assert(
      "LIVE-SW-02",
      "Querying Business C cart returns ONLY Business C items (does not leak Business A)",
      (cartContextC ?? []).length === 1 &&
        cartContextC?.[0].id === FIXTURES.cartC1 &&
        cartContextC?.[0].business_id === FIXTURES.businessC,
      `Business C returned item id=${cartContextC?.[0]?.id}`
    );

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Existing legacy V2 cart behavior remains intact during the migration window
    // ──────────────────────────────────────────────────────────────────────────
    section("7. Legacy V2 Cart Backwards Compatibility");

    // Insert a legacy V2 cart item (business_id is NULL, business_clerk_id set)
    const { data: legacyInsert, error: legacyInsertErr } = await clientBuyerA
      .from("cart_items")
      .insert({
        id: FIXTURES.cartV2,
        business_id: null,
        business_clerk_id: PERSONAS.buyerA.clerkId,
        product_id: FIXTURES.product1,
        quantity: 7,
      })
      .select()
      .maybeSingle();

    assert(
      "LIVE-V2-01",
      "Legacy V2 user can INSERT cart item with business_id = NULL using clerk_id",
      legacyInsertErr === null && legacyInsert?.id === FIXTURES.cartV2,
      legacyInsertErr ? `Error: ${legacyInsertErr.message}` : `Inserted legacy id=${legacyInsert?.id}`
    );

    const { data: legacySelect, error: legacySelectErr } = await clientBuyerA
      .from("cart_items")
      .select("id, business_id, business_clerk_id, quantity")
      .is("business_id", null)
      .eq("business_clerk_id", PERSONAS.buyerA.clerkId);

    assert(
      "LIVE-V2-02",
      "Legacy V2 user can SELECT their own un-migrated cart items",
      legacySelectErr === null && (legacySelect ?? []).some((i) => i.id === FIXTURES.cartV2),
      legacySelectErr ? `Error: ${legacySelectErr.message}` : `Found ${legacySelect?.length} legacy item(s)`
    );

    // Another user cannot see buyerA's legacy cart item
    const { data: legacyCrossRead } = await clientBuyerB
      .from("cart_items")
      .select("id, business_clerk_id")
      .eq("id", FIXTURES.cartV2);

    assert(
      "LIVE-V2-03",
      "Other user cannot read buyerA's legacy cart item",
      (legacyCrossRead ?? []).length === 0,
      `Cross read count=${legacyCrossRead?.length ?? 0}`
    );
  } finally {
    await cleanup();
  }

  // ── Results Summary ────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n${"=".repeat(76)}`);
  console.log(`  LIVE TEST RESULTS: ${passed} PASSED, ${failed} FAILED (Total: ${results.length})`);
  console.log("=".repeat(76));

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveTests().catch((err) => {
  console.error("\nFATAL: Live verification script failed with unhandled exception:", err);
  process.exit(1);
});
