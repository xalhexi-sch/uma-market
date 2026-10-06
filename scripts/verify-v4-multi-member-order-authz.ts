/**
 * UMA Market V4 — LIVE verification: multi-member order authorization
 * (pending-order cancellation + verified review insertion)
 *
 * FINDING UNDER TEST:
 *   V4 orders are owned by `orders.business_id` and placed by any member of
 *   that business, but two write paths still authenticate the caller through
 *   the legacy V2 identity `orders.business_clerk_id`:
 *     1. RLS "orders: business cancels pending"  — USING/WITH CHECK require
 *        `auth.jwt()->>'sub' = business_clerk_id`.
 *     2. RLS "seller_reviews / product_reviews: completed buyer inserts own"
 *        — require `o.business_clerk_id = reviewer_clerk_id`.
 *   For a business with more than one member those two identities differ, so a
 *   legitimate STAFF (or an OWNER cancelling an order a colleague placed) is
 *   denied, while isolation itself is only an accident of the legacy column.
 *
 * FIX UNDER TEST:
 *   Both policies gain a second, membership-based branch over
 *   `public.business_members`, exactly like the existing SELECT policies in
 *   20261006000001. Legacy (`business_id IS NULL`) rows keep the legacy rule.
 *
 * SAFETY RULES:
 *   1. Credentials loaded exclusively from .env.security-test.local.
 *   2. Aborts (exit 2) unless pointing at the dedicated security-test project.
 *   3. Authorization cases run as real Clerk Development sessions, never as
 *      service_role. service_role only seeds fixtures and reads back state.
 *   4. Fixture UUIDs prefixed "d5000010-"; every row is removed before/after.
 *
 * REQUIRES migration 20261010000000_v4_multi_member_order_authz.sql applied
 * to the security-test project (this suite is RED until it is).
 *
 * HOW TO RUN:
 *   npx tsx scripts/verify-v4-multi-member-order-authz.ts
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/nextjs/server";
import { assertClerkDevelopmentKey, loadSecurityTestEnv } from "./lib/safety-guard";

// ── Environment Guard ────────────────────────────────────────────────────────

const SCRIPT = "verify-v4-multi-member-order-authz";

const env = loadSecurityTestEnv(SCRIPT);
assertClerkDevelopmentKey(SCRIPT, env.clerkSecretKey);

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

// ── Personas (Clerk Development users shared with the other V4 live suites) ──

const PERSONAS = {
  owner: "user_3JhPbugktYsiMOGIDxF40YwRzx7", // Clerk role business → OWNER of businessA
  staff: "user_3JhUSSDpL2bmzswoMoNM6RzDkyn", // Clerk role business → STAFF of businessA
  outsider: "user_3JsrSu63Z45VhptJb0YqqkFhqt2", // Clerk role business → OWNER of businessB only
  producer: "user_3JhUSQewYXAYXR80cEFQNwGvsZs", // Clerk role farmer  → the producer on every fixture order
  farmerMember: "user_3JhPbDuVSiPLuEA6Z8oo86c4Jmr", // Clerk role farmer → STAFF of businessA (ineligible reviewer)
};

// ── Fixtures ─────────────────────────────────────────────────────────────────

const id = (n: number) => `d5000010-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const FIX = {
  businessA: id(0x101),
  businessB: id(0x102),
  product: id(0x201),

  // Pending orders — cancellation cases
  cancelOwner: id(0x301), // A, business_clerk_id = owner
  cancelStaff: id(0x302), // A, business_clerk_id = owner  (STAFF is not the legacy identity)
  cancelLegacyOwner: id(0x303), // A, business_clerk_id = staff (OWNER cancels a colleague's order)
  cancelCrossA: id(0x304), // A — outsider attempts
  cancelOtherOwn: id(0x305), // B — outsider's own order (positive control)
  cancelCrossB: id(0x306), // B — OWNER of A attempts
  cancelLegacyRow: id(0x307), // A with business_id NULL — legacy identity rule must survive
  cancelState: id(0x308), // A, status 'accepted' — order-state rule must survive

  // Completed orders — verified review cases
  revOwner: id(0x311), // A — OWNER positive control
  revStaff: id(0x312), // A — STAFF
  revCross: id(0x313), // A — outsider attempts
  revOther: id(0x314), // B — outsider's own order (positive control)
  revState: id(0x315), // A, status 'pending' — order-state rule must survive
  revAnon: id(0x316), // A — anonymous attempts
  revSuspend: id(0x317), // A — STAFF while their profile is suspended
  revFarmer: id(0x318), // A — farmer-role member attempts

  // Order items (one per product-review case)
  itemOwner: id(0x401), // on revOwner
  itemStaff: id(0x402), // on revStaff
  itemCross: id(0x403), // on revCross
  itemOther: id(0x404), // on revOther
};

const ALL_ORDER_IDS = [
  FIX.cancelOwner, FIX.cancelStaff, FIX.cancelLegacyOwner, FIX.cancelCrossA,
  FIX.cancelOtherOwn, FIX.cancelCrossB, FIX.cancelLegacyRow, FIX.cancelState,
  FIX.revOwner, FIX.revStaff, FIX.revCross, FIX.revOther,
  FIX.revState, FIX.revAnon, FIX.revSuspend, FIX.revFarmer,
];

const FIXTURE_BUSINESSES = [FIX.businessA, FIX.businessB];

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

interface WriteOutcome {
  code: string | null;
  rows: number;
  message: string;
}

/** One buyer-side cancellation attempt through the caller's own client. */
async function cancelAttempt(client: SupabaseClient, orderId: string): Promise<WriteOutcome> {
  const { data, error } = await client
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "multi-member authorization probe",
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("id");
  return {
    code: error?.code ?? null,
    rows: Array.isArray(data) ? data.length : 0,
    message: error?.message ?? "",
  };
}

async function insertSellerReview(
  client: SupabaseClient,
  orderId: string,
  reviewer: string,
  producer: string
): Promise<WriteOutcome> {
  const { data, error } = await client
    .from("seller_reviews")
    .insert({
      order_id: orderId,
      reviewer_clerk_id: reviewer,
      target_farmer_clerk_id: producer,
      rating: 5,
      comment: "multi-member authorization probe",
    })
    .select("id");
  return {
    code: error?.code ?? null,
    rows: Array.isArray(data) ? data.length : 0,
    message: error?.message ?? "",
  };
}

async function insertProductReview(
  client: SupabaseClient,
  orderId: string,
  orderItemId: string,
  reviewer: string
): Promise<WriteOutcome> {
  const { data, error } = await client
    .from("product_reviews")
    .insert({
      order_id: orderId,
      order_item_id: orderItemId,
      reviewer_clerk_id: reviewer,
      product_id: FIX.product,
      rating: 4,
      comment: "multi-member authorization probe",
    })
    .select("id");
  return {
    code: error?.code ?? null,
    rows: Array.isArray(data) ? data.length : 0,
    message: error?.message ?? "",
  };
}

async function readOrder(orderId: string): Promise<{ status: string; business_id: string | null; business_clerk_id: string }> {
  const { data, error } = await adminClient
    .from("orders")
    .select("status, business_id, business_clerk_id")
    .eq("id", orderId)
    .single();
  if (error) throw new Error(`readOrder(${orderId}): ${error.message}`);
  return data as { status: string; business_id: string | null; business_clerk_id: string };
}

async function countReviews(table: "seller_reviews" | "product_reviews", orderId: string): Promise<number> {
  const { count, error } = await adminClient
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);
  if (error) throw new Error(`countReviews(${table}, ${orderId}): ${error.message}`);
  return count ?? -1;
}

// ── Cleanup / seed ───────────────────────────────────────────────────────────

const originalProfileStatus = new Map<string, string | null>();

async function cleanup(): Promise<void> {
  // Order + review notifications are written by triggers in the same
  // transaction as their source row and do not cascade on delete.
  const { error: notifErr } = await adminClient
    .from("notifications")
    .delete()
    .in("entity_id", [...ALL_ORDER_IDS, FIX.product]);
  if (notifErr) console.error(`  cleanup notifications: ${notifErr.message}`);

  const { error: sellerErr } = await adminClient.from("seller_reviews").delete().in("order_id", ALL_ORDER_IDS);
  if (sellerErr) console.error(`  cleanup seller_reviews: ${sellerErr.message}`);

  const { error: productReviewErr } = await adminClient.from("product_reviews").delete().in("order_id", ALL_ORDER_IDS);
  if (productReviewErr) console.error(`  cleanup product_reviews: ${productReviewErr.message}`);

  const { error: itemErr } = await adminClient.from("order_items").delete().in("order_id", ALL_ORDER_IDS);
  if (itemErr) console.error(`  cleanup order_items: ${itemErr.message}`);

  const { error: orderErr } = await adminClient.from("orders").delete().in("id", ALL_ORDER_IDS);
  if (orderErr) console.error(`  cleanup orders: ${orderErr.message}`);

  await adminClient.from("cart_items").delete().eq("product_id", FIX.product);
  const { error: prodErr } = await adminClient.from("products").delete().eq("id", FIX.product);
  if (prodErr) console.error(`  cleanup products: ${prodErr.message}`);

  await adminClient.from("business_members").delete().in("business_id", FIXTURE_BUSINESSES);
  const { error: bizErr } = await adminClient.from("businesses").delete().in("id", FIXTURE_BUSINESSES);
  if (bizErr) console.error(`  cleanup businesses: ${bizErr.message}`);

  for (const [clerkId, status] of originalProfileStatus) {
    if (status) await adminClient.from("profiles").update({ status }).eq("clerk_id", clerkId);
  }

  for (const sessionId of activeClerkSessionIds.splice(0)) {
    try {
      await clerk.sessions.revokeSession(sessionId);
    } catch {
      // Session may already be gone.
    }
  }
}

async function seed(): Promise<void> {
  const { data: profiles, error: profErr } = await adminClient
    .from("profiles")
    .select("clerk_id, status")
    .in("clerk_id", Object.values(PERSONAS));
  if (profErr) throw new Error(`profiles: ${profErr.message}`);
  for (const clerkId of Object.values(PERSONAS)) {
    const row = profiles?.find((p) => p.clerk_id === clerkId);
    if (!row) throw new Error(`Persona ${clerkId} has no profile row in the security-test DB.`);
    originalProfileStatus.set(clerkId, row.status);
    if (row.status !== "active") {
      await adminClient.from("profiles").update({ status: "active" }).eq("clerk_id", clerkId);
    }
  }

  const { error: bizErr } = await adminClient.from("businesses").upsert([
    // legacy_clerk_id stays NULL: the fixture orders carry the legacy identity
    // themselves, which is exactly how V4 checkout writes them
    // (COALESCE(business.legacy_clerk_id, caller)).
    { id: FIX.businessA, name: "Multi-Member Buyer Co", can_buy: true, can_sell: false, status: "active" },
    { id: FIX.businessB, name: "Multi-Member Other Co", can_buy: true, can_sell: false, status: "active" },
  ]);
  if (bizErr) throw new Error(`seed businesses: ${bizErr.message}`);

  const { error: memErr } = await adminClient.from("business_members").upsert(
    [
      { business_id: FIX.businessA, user_id: PERSONAS.owner, role: "OWNER" },
      { business_id: FIX.businessA, user_id: PERSONAS.staff, role: "STAFF" },
      { business_id: FIX.businessA, user_id: PERSONAS.farmerMember, role: "STAFF" },
      { business_id: FIX.businessB, user_id: PERSONAS.outsider, role: "OWNER" },
    ],
    { onConflict: "business_id,user_id" }
  );
  if (memErr) throw new Error(`seed business_members: ${memErr.message}`);

  const { data: catRow, error: catErr } = await adminClient
    .from("categories").select("id").eq("slug", "vegetables").single();
  if (catErr || !catRow) throw new Error(`category fixture missing: ${catErr?.message ?? "no rows"}`);
  const categoryId = catRow.id;

  const { error: prodErr } = await adminClient.from("products").upsert({
    id: FIX.product,
    farmer_clerk_id: PERSONAS.producer,
    category_id: categoryId,
    name: "Multi-Member Fixture Produce",
    price_per_unit: 10,
    unit: "kg",
    quantity_available: 100,
    min_order_quantity: 1,
    status: "active",
  });
  if (prodErr) throw new Error(`seed products: ${prodErr.message}`);

  const order = (
    oid: string,
    businessId: string | null,
    legacyIdentity: string,
    status: string
  ) => ({
    id: oid,
    business_id: businessId,
    business_clerk_id: legacyIdentity,
    farmer_clerk_id: PERSONAS.producer,
    status,
    fulfillment_type: "pickup",
    total_amount: 10,
  });

  const A = FIX.businessA;
  const B = FIX.businessB;
  const { error: orderErr } = await adminClient.from("orders").insert([
    order(FIX.cancelOwner, A, PERSONAS.owner, "pending"),
    order(FIX.cancelStaff, A, PERSONAS.owner, "pending"),
    order(FIX.cancelLegacyOwner, A, PERSONAS.staff, "pending"),
    order(FIX.cancelCrossA, A, PERSONAS.owner, "pending"),
    order(FIX.cancelOtherOwn, B, PERSONAS.outsider, "pending"),
    order(FIX.cancelCrossB, B, PERSONAS.outsider, "pending"),
    // Legacy V2 row: no V4 business ownership, only the legacy identity exists.
    order(FIX.cancelLegacyRow, null, PERSONAS.owner, "pending"),
    order(FIX.cancelState, A, PERSONAS.owner, "accepted"),

    order(FIX.revOwner, A, PERSONAS.owner, "completed"),
    order(FIX.revStaff, A, PERSONAS.owner, "completed"),
    order(FIX.revCross, A, PERSONAS.owner, "completed"),
    order(FIX.revOther, B, PERSONAS.outsider, "completed"),
    order(FIX.revState, A, PERSONAS.owner, "pending"),
    order(FIX.revAnon, A, PERSONAS.owner, "completed"),
    order(FIX.revSuspend, A, PERSONAS.owner, "completed"),
    order(FIX.revFarmer, A, PERSONAS.owner, "completed"),
  ]);
  if (orderErr) throw new Error(`seed orders: ${orderErr.message}`);

  const item = (iid: string, oid: string) => ({
    id: iid,
    order_id: oid,
    product_id: FIX.product,
    quantity: 1,
    unit_price: 10,
    product_name: "Multi-Member Fixture Produce",
    unit: "kg",
  });
  const { error: itemErr } = await adminClient.from("order_items").insert([
    item(FIX.itemOwner, FIX.revOwner),
    item(FIX.itemStaff, FIX.revStaff),
    item(FIX.itemCross, FIX.revCross),
    item(FIX.itemOther, FIX.revOther),
  ]);
  if (itemErr) throw new Error(`seed order_items: ${itemErr.message}`);
}

// ── Suite ────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`  Target: ${env.supabaseUrl}`);
  await cleanup();
  await seed();

  const owner = await getAuthenticatedClient(PERSONAS.owner);
  const staff = await getAuthenticatedClient(PERSONAS.staff);
  const outsider = await getAuthenticatedClient(PERSONAS.outsider);
  const farmerMember = await getAuthenticatedClient(PERSONAS.farmerMember);

  // ══════════════════════════════════════════════════════════════════════════
  section("CANCEL — pending-order cancellation by business members");
  // ══════════════════════════════════════════════════════════════════════════

  {
    const r = await cancelAttempt(owner, FIX.cancelOwner);
    assert(
      "CAN-01",
      "OWNER cancels the business's pending order (positive control)",
      r.rows === 1 && (await readOrder(FIX.cancelOwner)).status === "cancelled",
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    const r = await cancelAttempt(staff, FIX.cancelStaff);
    assert(
      "CAN-02",
      "STAFF cancels the business's pending order (not the legacy identity)",
      r.rows === 1 && (await readOrder(FIX.cancelStaff)).status === "cancelled",
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    const r = await cancelAttempt(owner, FIX.cancelLegacyOwner);
    assert(
      "CAN-03",
      "OWNER cancels an order a colleague placed (membership, not legacy identity)",
      r.rows === 1 && (await readOrder(FIX.cancelLegacyOwner)).status === "cancelled",
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    const before = await readOrder(FIX.cancelCrossA);
    const r = await cancelAttempt(outsider, FIX.cancelCrossA);
    assert(
      "CAN-04",
      "A member of another business cannot cancel this business's order",
      r.rows === 0 && before.status === "pending",
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    const r = await cancelAttempt(outsider, FIX.cancelOtherOwn);
    assert(
      "CAN-05",
      "the outsider CAN cancel their own business's order (denial is row-level, not blanket)",
      r.rows === 1 && (await readOrder(FIX.cancelOtherOwn)).status === "cancelled",
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    const before = await readOrder(FIX.cancelCrossB);
    const r = await cancelAttempt(owner, FIX.cancelCrossB);
    assert(
      "CAN-06",
      "OWNER of Business A cannot cancel Business B's order (isolation A → B)",
      r.rows === 0 && before.status === "pending",
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    const r = await cancelAttempt(anonClient, FIX.cancelCrossA);
    assert(
      "CAN-07",
      "anonymous cannot cancel a pending order",
      r.rows === 0,
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    const r = await cancelAttempt(owner, FIX.cancelState);
    assert(
      "CAN-08",
      "only pending orders can be cancelled (order-state rule preserved)",
      r.rows === 0 && (await readOrder(FIX.cancelState)).status === "accepted",
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    // Legacy row: business_id IS NULL, so only the legacy identity rule applies.
    const denied = await cancelAttempt(staff, FIX.cancelLegacyRow);
    const allowed = await cancelAttempt(owner, FIX.cancelLegacyRow);
    assert(
      "CAN-09",
      "legacy (business_id NULL) rows keep the legacy identity rule: STAFF denied, identity holder allowed",
      denied.rows === 0 && allowed.rows === 1 && (await readOrder(FIX.cancelLegacyRow)).status === "cancelled",
      `staff: ${denied.code}/${denied.rows} | owner: ${allowed.code}/${allowed.rows} ${allowed.message}`
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("REVIEW — verified seller/product review insertion");
  // ══════════════════════════════════════════════════════════════════════════

  {
    const r = await insertSellerReview(owner, FIX.revOwner, PERSONAS.owner, PERSONAS.producer);
    assert("RVW-01", "OWNER inserts a seller review on their business's completed order (positive control)", r.rows === 1, `${r.code} rows=${r.rows} ${r.message}`);
  }
  {
    const r = await insertSellerReview(staff, FIX.revStaff, PERSONAS.staff, PERSONAS.producer);
    assert("RVW-02", "STAFF inserts a seller review on their business's completed order", r.rows === 1, `${r.code} rows=${r.rows} ${r.message}`);
  }
  {
    const before = await countReviews("seller_reviews", FIX.revCross);
    const r = await insertSellerReview(outsider, FIX.revCross, PERSONAS.outsider, PERSONAS.producer);
    assert(
      "RVW-03",
      "a member of another business cannot review this business's order",
      r.rows === 0 && (await countReviews("seller_reviews", FIX.revCross)) === before,
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    const r = await insertSellerReview(outsider, FIX.revOther, PERSONAS.outsider, PERSONAS.producer);
    assert("RVW-04", "the outsider CAN review their own business's order (denial is row-level)", r.rows === 1, `${r.code} rows=${r.rows} ${r.message}`);
  }
  {
    const r = await insertSellerReview(owner, FIX.revState, PERSONAS.owner, PERSONAS.producer);
    assert("RVW-05", "a pending order cannot be reviewed (order-state rule preserved)", r.rows === 0, `${r.code} rows=${r.rows} ${r.message}`);
  }
  {
    const r = await insertSellerReview(anonClient, FIX.revAnon, PERSONAS.owner, PERSONAS.producer);
    assert("RVW-06", "anonymous cannot insert a review", r.rows === 0, `${r.code} rows=${r.rows} ${r.message}`);
  }
  {
    await adminClient.from("profiles").update({ status: "suspended" }).eq("clerk_id", PERSONAS.staff);
    const r = await insertSellerReview(staff, FIX.revSuspend, PERSONAS.staff, PERSONAS.producer);
    await adminClient.from("profiles").update({ status: "active" }).eq("clerk_id", PERSONAS.staff);
    assert(
      "RVW-07",
      "a suspended member still cannot insert a review (account-status rule preserved)",
      r.rows === 0 && (await countReviews("seller_reviews", FIX.revSuspend)) === 0,
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    const r = await insertSellerReview(farmerMember, FIX.revFarmer, PERSONAS.farmerMember, PERSONAS.producer);
    assert(
      "RVW-08",
      "a member without the business role still cannot insert a review (eligibility rule preserved)",
      r.rows === 0 && (await countReviews("seller_reviews", FIX.revFarmer)) === 0,
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    const r = await insertProductReview(owner, FIX.revOwner, FIX.itemOwner, PERSONAS.owner);
    assert("RVW-09", "OWNER inserts a product review (positive control)", r.rows === 1, `${r.code} rows=${r.rows} ${r.message}`);
  }
  {
    const r = await insertProductReview(staff, FIX.revStaff, FIX.itemStaff, PERSONAS.staff);
    assert("RVW-10", "STAFF inserts a product review on their business's order item", r.rows === 1, `${r.code} rows=${r.rows} ${r.message}`);
  }
  {
    const before = await countReviews("product_reviews", FIX.revCross);
    const r = await insertProductReview(outsider, FIX.revCross, FIX.itemCross, PERSONAS.outsider);
    assert(
      "RVW-11",
      "a member of another business cannot review this business's order item",
      r.rows === 0 && (await countReviews("product_reviews", FIX.revCross)) === before,
      `${r.code} rows=${r.rows} ${r.message}`
    );
  }
  {
    const r = await insertProductReview(outsider, FIX.revOther, FIX.itemOther, PERSONAS.outsider);
    assert("RVW-12", "the outsider CAN review their own business's order item (positive control)", r.rows === 1, `${r.code} rows=${r.rows} ${r.message}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("PROV — review provenance and business isolation invariants");
  // ══════════════════════════════════════════════════════════════════════════

  {
    const { data: rows } = await adminClient
      .from("seller_reviews")
      .select("order_id, reviewer_clerk_id, target_farmer_clerk_id")
      .in("order_id", [FIX.revOwner, FIX.revStaff, FIX.revOther]);
    const byOrder = new Map((rows ?? []).map((r) => [r.order_id, r]));
    const staffRow = byOrder.get(FIX.revStaff);
    assert(
      "PROV-01",
      "the STAFF review records the STAFF member as reviewer (provenance unchanged)",
      staffRow?.reviewer_clerk_id === PERSONAS.staff && staffRow?.target_farmer_clerk_id === PERSONAS.producer,
      JSON.stringify(staffRow ?? null)
    );
    const { data: crossLeak } = await adminClient
      .from("seller_reviews")
      .select("id")
      .eq("order_id", FIX.revCross);
    assert("PROV-02", "no review row was written for the cross-business attempt", (crossLeak ?? []).length === 0, JSON.stringify(crossLeak ?? []));
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
