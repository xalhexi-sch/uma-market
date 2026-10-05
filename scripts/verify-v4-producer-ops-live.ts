/**
 * UMA Market V4 — LIVE verification: producer listings + inventory
 * (authorization, moderation, ledger correctness, concurrency, checkout compatibility)
 *
 * SAFETY RULES:
 *   1. Credentials loaded exclusively from .env.security-test.local.
 *   2. Aborts (exit 2) unless pointing at the dedicated security-test project.
 *   3. Uses the Clerk Development instance to mint real session JWTs; every
 *      authorization case runs as a real user, never as service_role.
 *   4. Deterministic fixture UUIDs prefixed "d5000004-". Cleaned up in finally.
 *
 * REQUIRES migration 20261006100000_v4_producer_listings_inventory.sql applied
 * to the security-test project.
 *
 * COVERS:
 *   AUTH  SELL-only OWNER / STAFF and BUY+SELL OWNER allowed; BUY-only, non-member,
 *         cross-business, suspended business, suspended caller and anonymous denied;
 *         direct table writes (stock, ownership, ledger) denied; STAFF cannot do
 *         OWNER business administration; RLS read isolation.
 *   LIST  create / edit / publish / unpublish / archive / restore; edits never
 *         un-archive; moderation can't be overridden; server-side validation.
 *   INV   receive / loss / count correction; negative stock prevented; stale
 *         counts rejected; ledger rows and SUM(delta) = balance invariant.
 *   RACE  LIVE concurrency with two members of the same business: no lost update,
 *         no negative stock, deterministic final balance; checkout vs. loss race.
 *   CHK   V4 checkout still decrements atomically and is recorded as SOLD with its
 *         order; cancellation restock is recorded as RELEASED.
 *
 * HOW TO RUN:
 *   npm run verify:v4-producer-ops-live
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/nextjs/server";
import { assertClerkDevelopmentKey, loadSecurityTestEnv } from "./lib/safety-guard";

// ── Environment Guard ────────────────────────────────────────────────────────

const env = loadSecurityTestEnv("verify-v4-producer-ops-live");
assertClerkDevelopmentKey("verify-v4-producer-ops-live", env.clerkSecretKey);

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

// ── Personas (Clerk Development users shared with verify-v4-checkout-live) ───

const PERSONAS = {
  farmerA: "user_3JhPbDuVSiPLuEA6Z8oo86c4Jmr", // Clerk role farmer  → OWNER of SELL
  buyerB: "user_3JhUSSDpL2bmzswoMoNM6RzDkyn", // Clerk role business → STAFF of SELL
  buyerA: "user_3JhPbugktYsiMOGIDxF40YwRzx7", // Clerk role business → OWNER of BOTH
  farmerB: "user_3JhUSQewYXAYXR80cEFQNwGvsZs", // Clerk role farmer  → OWNER of BUY-only, non-member elsewhere
};

const id = (n: number) => `d5000004-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const FIX = {
  category: id(1),
  businessSell: id(0x101), // can_sell only
  businessBoth: id(0x102), // can_buy + can_sell
  businessBuy: id(0x103), // can_buy only
  // Seeded products (all in businessSell unless noted)
  pRace: id(0x201),
  pCount: id(0x202),
  pLoss: id(0x203),
  pBurst: id(0x204),
  pCheckout: id(0x205),
  pModerated: id(0x206),
  pBoth: id(0x207), // businessBoth
  pAuth: id(0x208),
};

const tomorrow = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() + 86_400_000));

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
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${testId.padEnd(14)} ${name}`);
  if (!condition && details) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(76)}\n  ${title}\n${"=".repeat(76)}`);
}

interface RpcOutcome {
  ok: boolean;
  code: string | null;
  message: string;
  data: unknown;
}

async function rpc(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<RpcOutcome> {
  const { data, error } = await client.rpc(fn, args);
  return { ok: !error, code: error?.code ?? null, message: error?.message ?? "", data };
}

function adjust(
  client: SupabaseClient,
  businessId: string,
  productId: string,
  type: string,
  quantity: number,
  extra: { reason?: string; expected?: number } = {}
): Promise<RpcOutcome> {
  return rpc(client, "adjust_business_inventory", {
    p_business_id: businessId,
    p_product_id: productId,
    p_movement_type: type,
    p_quantity: quantity,
    p_reason: extra.reason ?? null,
    p_expected_quantity: extra.expected ?? null,
  });
}

function listingArgs(businessId: string, overrides: Record<string, unknown> = {}) {
  return {
    p_business_id: businessId,
    p_name: "Live Test Listing",
    p_category_id: FIX.category,
    p_description: "Created by verify-v4-producer-ops-live",
    p_price_per_unit: 120,
    p_unit: "kg",
    p_min_order_quantity: 2,
    p_opening_quantity: 25,
    p_harvest_date: null,
    p_available_until: null,
    p_status: "draft",
    p_image_paths: [],
    ...overrides,
  };
}

async function readProduct(productId: string) {
  const { data, error } = await adminClient
    .from("products")
    .select("id, status, moderation_status, quantity_available, business_id, farmer_clerk_id, name, price_per_unit")
    .eq("id", productId)
    .single();
  if (error) throw new Error(`readProduct(${productId}): ${error.message}`);
  return { ...data, quantity_available: Number(data.quantity_available), price_per_unit: Number(data.price_per_unit) };
}

async function stockOf(productId: string): Promise<number> {
  return (await readProduct(productId)).quantity_available;
}

/** Service-role reset (recorded by the ledger as a system ADJUSTMENT). */
async function setStock(productId: string, quantity: number): Promise<void> {
  const { error } = await adminClient.from("products").update({ quantity_available: quantity }).eq("id", productId);
  if (error) throw new Error(`setStock(${productId}): ${error.message}`);
}

async function movementsOf(productId: string, sinceIso?: string) {
  let query = adminClient
    .from("inventory_movements")
    .select("movement_type, quantity_delta, balance_after, reason, reference_type, reference_id, created_by, business_id, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });
  if (sinceIso) query = query.gte("created_at", sinceIso);
  const { data, error } = await query;
  if (error) throw new Error(`movementsOf(${productId}): ${error.message}`);
  return (data ?? []).map((m) => ({
    ...m,
    quantity_delta: Number(m.quantity_delta),
    balance_after: Number(m.balance_after),
  }));
}

/** SUM(quantity_delta) over the full ledger must equal the stored balance. */
async function ledgerMatchesBalance(productId: string): Promise<{ ok: boolean; sum: number; balance: number }> {
  const all = await movementsOf(productId);
  const sum = Math.round(all.reduce((acc, m) => acc + m.quantity_delta, 0) * 100) / 100;
  const balance = await stockOf(productId);
  return { ok: sum === balance, sum, balance };
}

/** Server time, so "rows written since" comparisons don't depend on local clock skew. */
async function dbNow(): Promise<string> {
  const { data, error } = await adminClient.from("inventory_movements").select("created_at").order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(`dbNow: ${error.message}`);
  return data?.[0]?.created_at ?? new Date(0).toISOString();
}

// ── Cleanup / seed ───────────────────────────────────────────────────────────

const FIXTURE_BUSINESSES = [FIX.businessSell, FIX.businessBoth, FIX.businessBuy];
const originalProfileStatus = new Map<string, string | null>();

async function cleanup(): Promise<void> {
  console.log("\n  [Cleanup] Removing producer-ops fixtures...");

  const { data: orders } = await adminClient.from("orders").select("id").in("business_id", FIXTURE_BUSINESSES);
  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (orderIds.length > 0) {
    await adminClient.from("notifications").delete().in("entity_id", orderIds);
    await adminClient.from("order_items").delete().in("order_id", orderIds);
    await adminClient.from("orders").delete().in("id", orderIds);
  }

  await adminClient.from("cart_items").delete().in("business_id", FIXTURE_BUSINESSES);
  // Cascades to product_images and inventory_movements.
  await adminClient.from("products").delete().in("business_id", FIXTURE_BUSINESSES);
  await adminClient.from("products").delete().in("id", Object.values(FIX));
  await adminClient.from("business_members").delete().in("business_id", FIXTURE_BUSINESSES);
  await adminClient.from("businesses").delete().in("id", FIXTURE_BUSINESSES);
  await adminClient.from("categories").delete().eq("id", FIX.category);

  for (const [clerkId, status] of originalProfileStatus) {
    if (status) await adminClient.from("profiles").update({ status }).eq("clerk_id", clerkId);
  }

  for (const sessionId of activeClerkSessionIds) {
    try {
      await clerk.sessions.revokeSession(sessionId);
    } catch {
      /* ignore */
    }
  }
  activeClerkSessionIds.length = 0;
  console.log("  [Cleanup] Finished.");
}

async function seed(): Promise<void> {
  console.log("  [Seed] Setting up producer-ops fixtures...");

  // Personas must have active profiles (the RPCs require an active caller).
  const { data: profiles, error: profErr } = await adminClient
    .from("profiles")
    .select("clerk_id, status")
    .in("clerk_id", Object.values(PERSONAS));
  if (profErr) throw new Error(`profiles: ${profErr.message}`);
  for (const clerkId of Object.values(PERSONAS)) {
    const row = profiles?.find((p) => p.clerk_id === clerkId);
    if (!row) throw new Error(`Persona ${clerkId} has no profile in the security-test DB; run the checkout live seed first.`);
    originalProfileStatus.set(clerkId, row.status);
    if (row.status !== "active") {
      await adminClient.from("profiles").update({ status: "active" }).eq("clerk_id", clerkId);
    }
  }

  const { error: catErr } = await adminClient.from("categories").upsert({
    id: FIX.category,
    name: "Live Producer Ops Category",
    slug: "live-producer-ops-category",
    description: "Category for V4 producer-ops live verification",
    icon: "ri-plant-line",
  });
  if (catErr) throw new Error(`category: ${catErr.message}`);

  const { error: bizErr } = await adminClient.from("businesses").upsert([
    { id: FIX.businessSell, name: "Live Producer Farm (Sell)", can_buy: false, can_sell: true, status: "active" },
    { id: FIX.businessBoth, name: "Live Producer Co-op (Both)", can_buy: true, can_sell: true, status: "active" },
    { id: FIX.businessBuy, name: "Live Producer Kitchen (Buy)", can_buy: true, can_sell: false, status: "active" },
  ]);
  if (bizErr) throw new Error(`businesses: ${bizErr.message}`);

  const { error: memErr } = await adminClient.from("business_members").upsert(
    [
      { business_id: FIX.businessSell, user_id: PERSONAS.farmerA, role: "OWNER" },
      { business_id: FIX.businessSell, user_id: PERSONAS.buyerB, role: "STAFF" },
      { business_id: FIX.businessBoth, user_id: PERSONAS.buyerA, role: "OWNER" },
      { business_id: FIX.businessBuy, user_id: PERSONAS.farmerB, role: "OWNER" },
    ],
    { onConflict: "business_id,user_id" }
  );
  if (memErr) throw new Error(`business_members: ${memErr.message}`);

  const product = (pid: string, name: string, quantity: number, businessId = FIX.businessSell, owner = PERSONAS.farmerA) => ({
    id: pid,
    business_id: businessId,
    farmer_clerk_id: owner,
    category_id: FIX.category,
    name,
    price_per_unit: 100,
    unit: "kg",
    quantity_available: quantity,
    min_order_quantity: 1,
    status: "active",
    moderation_status: "approved",
  });

  const { error: prodErr } = await adminClient.from("products").upsert([
    product(FIX.pRace, "Race Tomatoes", 100),
    product(FIX.pCount, "Count Onions", 100),
    product(FIX.pLoss, "Loss Cabbage", 100),
    product(FIX.pBurst, "Burst Carrots", 50),
    product(FIX.pCheckout, "Checkout Kale", 100),
    product(FIX.pModerated, "Moderated Basil", 10),
    product(FIX.pAuth, "Auth Squash", 40),
    product(FIX.pBoth, "Co-op Rice", 30, FIX.businessBoth, PERSONAS.buyerA),
  ]);
  if (prodErr) throw new Error(`products: ${prodErr.message}`);

  console.log("  [Seed] Fixtures ready.");
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`Target database: ${env.supabaseUrl}`);

  // Preflight: the migration must be present, otherwise every case is meaningless.
  const { error: preflight } = await adminClient.from("inventory_movements").select("id").limit(1);
  if (preflight) {
    console.error("  PREFLIGHT FAILED: public.inventory_movements is not available.");
    console.error("  Apply supabase/migrations/20261006100000_v4_producer_listings_inventory.sql to the security-test project first.");
    process.exit(1);
  }

  await cleanup();
  await seed();

  const owner = await getAuthenticatedClient(PERSONAS.farmerA);
  const staff = await getAuthenticatedClient(PERSONAS.buyerB);
  const bothOwner = await getAuthenticatedClient(PERSONAS.buyerA);
  const buyOnly = await getAuthenticatedClient(PERSONAS.farmerB);
  const anon = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ══════════════════════════════════════════════════════════════════════════
  section("1. Authorization — who may operate producer tools");
  // ══════════════════════════════════════════════════════════════════════════

  let ownerListingId = "";
  {
    const r = await rpc(owner, "create_business_listing", listingArgs(FIX.businessSell, { p_name: "Owner Created Peppers" }));
    ownerListingId = String(r.data ?? "");
    assert("AUTH-01", "SELL-only OWNER can create a listing", r.ok && Boolean(ownerListingId), r.message);
    if (ownerListingId) {
      const p = await readProduct(ownerListingId);
      assert("AUTH-01b", "Listing is owned by the active business (business_id set server-side)", p.business_id === FIX.businessSell, `business_id=${p.business_id}`);
      const moves = await movementsOf(ownerListingId);
      assert(
        "AUTH-01c",
        "Opening stock recorded as one OPENING movement by the creator",
        moves.length === 1 && moves[0].movement_type === "OPENING" && moves[0].quantity_delta === 25 && moves[0].created_by === PERSONAS.farmerA,
        JSON.stringify(moves)
      );
    }
  }
  {
    const r = await rpc(staff, "create_business_listing", listingArgs(FIX.businessSell, { p_name: "Staff Created Ginger" }));
    assert("AUTH-02", "STAFF (Clerk role 'business') can create a listing for the SELL business", r.ok, r.message);
    const adj = await adjust(staff, FIX.businessSell, FIX.pAuth, "RECEIVED", 5);
    assert("AUTH-02b", "STAFF can record stock received", adj.ok, adj.message);
  }
  {
    const r = await rpc(bothOwner, "create_business_listing", listingArgs(FIX.businessBoth, { p_name: "Co-op Mangoes" }));
    assert("AUTH-03", "BUY+SELL business OWNER can create a listing", r.ok, r.message);
    const adj = await adjust(bothOwner, FIX.businessBoth, FIX.pBoth, "RECEIVED", 10);
    assert("AUTH-03b", "BUY+SELL business OWNER can adjust its inventory", adj.ok, adj.message);
  }
  {
    const r = await rpc(buyOnly, "create_business_listing", listingArgs(FIX.businessBuy));
    assert("AUTH-04", "BUY-only business cannot create listings", !r.ok && r.code === "42501" && /selling capability/.test(r.message), `${r.code} ${r.message}`);
    const { count } = await adminClient.from("products").select("id", { count: "exact", head: true }).eq("business_id", FIX.businessBuy);
    assert("AUTH-04b", "No listing was written for the BUY-only business", (count ?? 0) === 0, `count=${count}`);
  }
  {
    const before = await stockOf(FIX.pAuth);
    const r = await adjust(buyOnly, FIX.businessSell, FIX.pAuth, "RECEIVED", 1000);
    assert("AUTH-05", "Non-member cannot adjust another business's stock", !r.ok && r.code === "42501", `${r.code} ${r.message}`);
    const s = await rpc(buyOnly, "set_business_listing_status", { p_business_id: FIX.businessSell, p_product_id: FIX.pAuth, p_status: "archived" });
    assert("AUTH-05b", "Non-member cannot archive another business's listing", !s.ok && s.code === "42501", `${s.code} ${s.message}`);
    assert("AUTH-05c", "Stock unchanged after rejected attempts", (await stockOf(FIX.pAuth)) === before);
  }
  {
    const before = await readProduct(FIX.pAuth);
    // buyerA legitimately belongs to the BOTH business, and names it — but the product is the SELL business's.
    const r = await adjust(bothOwner, FIX.businessBoth, FIX.pAuth, "RECEIVED", 1000);
    assert("AUTH-06", "Business A cannot adjust Business B's product via its own business id", !r.ok && r.code === "UMN01", `${r.code} ${r.message}`);
    const u = await rpc(bothOwner, "update_business_listing", {
      p_business_id: FIX.businessBoth,
      p_product_id: FIX.pAuth,
      p_name: "Hijacked",
      p_category_id: null,
      p_description: null,
      p_price_per_unit: 1,
      p_unit: "kg",
      p_min_order_quantity: 1,
      p_harvest_date: null,
      p_available_until: null,
    });
    assert("AUTH-06b", "Business A cannot edit Business B's listing", !u.ok && u.code === "UMN01", `${u.code} ${u.message}`);
    const r2 = await adjust(bothOwner, FIX.businessSell, FIX.pAuth, "RECEIVED", 1000);
    assert("AUTH-06c", "Business A cannot claim Business B's id", !r2.ok && r2.code === "42501", `${r2.code} ${r2.message}`);
    const after = await readProduct(FIX.pAuth);
    assert("AUTH-06d", "Business B's listing untouched", after.name === before.name && after.quantity_available === before.quantity_available);
  }
  {
    await adminClient.from("businesses").update({ status: "suspended" }).eq("id", FIX.businessSell);
    const r = await adjust(owner, FIX.businessSell, FIX.pAuth, "RECEIVED", 1);
    await adminClient.from("businesses").update({ status: "active" }).eq("id", FIX.businessSell);
    assert("AUTH-07", "Suspended business cannot operate producer tools", !r.ok && r.code === "42501" && /not active/.test(r.message), `${r.code} ${r.message}`);
  }
  {
    await adminClient.from("profiles").update({ status: "suspended" }).eq("clerk_id", PERSONAS.buyerB);
    const r = await adjust(staff, FIX.businessSell, FIX.pAuth, "RECEIVED", 1);
    await adminClient.from("profiles").update({ status: "active" }).eq("clerk_id", PERSONAS.buyerB);
    assert("AUTH-08", "Suspended member cannot operate producer tools", !r.ok && r.code === "42501", `${r.code} ${r.message}`);
  }
  {
    const r = await adjust(anon, FIX.businessSell, FIX.pAuth, "RECEIVED", 1);
    assert("AUTH-09", "Anonymous caller cannot execute inventory RPC", !r.ok, `${r.code} ${r.message}`);
  }
  {
    const before = await stockOf(FIX.pAuth);
    // farmerA is the legacy owner (farmer_clerk_id) with the legacy RLS UPDATE policy.
    const { error: qtyErr } = await owner.from("products").update({ quantity_available: 9999 }).eq("id", FIX.pAuth);
    assert("AUTH-10", "Legacy owner cannot write stock directly (last-write-wins path closed)", Boolean(qtyErr) && qtyErr?.code === "42501", qtyErr?.message ?? "no error");
    const { error: bizErr } = await owner.from("products").update({ business_id: FIX.businessBoth }).eq("id", FIX.pAuth);
    assert("AUTH-10b", "Legacy owner cannot move a listing to another business", Boolean(bizErr), bizErr?.message ?? "no error");
    const { error: priceErr } = await owner.from("products").update({ price_per_unit: 101 }).eq("id", FIX.pAuth);
    assert("AUTH-10c", "Legacy owner content edits still work (control)", !priceErr, priceErr?.message ?? "");
    const { data: staffRows } = await staff.from("products").update({ price_per_unit: 1 }).eq("id", FIX.pAuth).select("id");
    assert("AUTH-10d", "STAFF cannot bypass RPCs with direct table writes", (staffRows ?? []).length === 0);
    const { error: insErr } = await owner.from("inventory_movements").insert({
      product_id: FIX.pAuth, business_id: FIX.businessSell, movement_type: "RECEIVED", quantity_delta: 500, balance_after: 500,
    });
    assert("AUTH-10e", "Clients cannot forge ledger rows", Boolean(insErr), insErr?.message ?? "no error");
    const { data: delRows } = await owner.from("inventory_movements").delete().eq("product_id", FIX.pAuth).select("id");
    assert("AUTH-10f", "Clients cannot delete ledger rows", (delRows ?? []).length === 0);
    assert("AUTH-10g", "Stock unchanged by all direct-write attempts", (await stockOf(FIX.pAuth)) === before);
  }
  {
    const { data: staffBiz } = await staff.from("businesses").update({ can_sell: false }).eq("id", FIX.businessSell).select("id");
    const { data: biz } = await adminClient.from("businesses").select("can_sell").eq("id", FIX.businessSell).single();
    assert("AUTH-11", "OWNER-only business administration stays OWNER-only (STAFF can't change capabilities)", (staffBiz ?? []).length === 0 && biz?.can_sell === true);
  }
  {
    const { data: staffDrafts } = await staff.from("products").select("id, status").eq("business_id", FIX.businessSell).eq("status", "draft");
    assert("AUTH-12", "STAFF can read the business's draft listings", (staffDrafts ?? []).length >= 2, `rows=${staffDrafts?.length}`);
    const { data: outsiderDrafts } = await buyOnly.from("products").select("id").eq("business_id", FIX.businessSell).eq("status", "draft");
    assert("AUTH-12b", "Non-member cannot read another business's drafts", (outsiderDrafts ?? []).length === 0, `rows=${outsiderDrafts?.length}`);
    const { data: staffMoves } = await staff.from("inventory_movements").select("id").eq("business_id", FIX.businessSell);
    assert("AUTH-12c", "Member can read the business's stock history", (staffMoves ?? []).length > 0);
    const { data: outsiderMoves } = await bothOwner.from("inventory_movements").select("id").eq("business_id", FIX.businessSell);
    assert("AUTH-12d", "Other business cannot read the stock history", (outsiderMoves ?? []).length === 0, `rows=${outsiderMoves?.length}`);
    const { data: buyMoves } = await buyOnly.from("inventory_movements").select("id").eq("business_id", FIX.businessBuy);
    assert("AUTH-12e", "BUY-only member sees no producer history", (buyMoves ?? []).length === 0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("2. Listings — lifecycle, moderation, validation");
  // ══════════════════════════════════════════════════════════════════════════

  if (ownerListingId) {
    const pub = await rpc(staff, "set_business_listing_status", { p_business_id: FIX.businessSell, p_product_id: ownerListingId, p_status: "active" });
    assert("LIST-01", "Publish a draft (STAFF)", pub.ok && (await readProduct(ownerListingId)).status === "active", pub.message);

    const upd = await rpc(owner, "update_business_listing", {
      p_business_id: FIX.businessSell,
      p_product_id: ownerListingId,
      p_name: "Owner Created Peppers (Grade A)",
      p_category_id: FIX.category,
      p_description: "Updated",
      p_price_per_unit: 135.5,
      p_unit: "kg",
      p_min_order_quantity: 3,
      p_harvest_date: "2026-10-01",
      p_available_until: "2026-10-30",
      p_status: "active",
      p_image_paths: [],
    });
    const edited = await readProduct(ownerListingId);
    assert("LIST-02", "Edit details", upd.ok && edited.name === "Owner Created Peppers (Grade A)" && edited.price_per_unit === 135.5, upd.message);
    assert("LIST-02b", "Edit never changes stock", edited.quantity_available === 25, `qty=${edited.quantity_available}`);

    const unpub = await rpc(owner, "set_business_listing_status", { p_business_id: FIX.businessSell, p_product_id: ownerListingId, p_status: "draft" });
    assert("LIST-03", "Unpublish (active → draft)", unpub.ok && (await readProduct(ownerListingId)).status === "draft", unpub.message);

    const arc = await rpc(staff, "set_business_listing_status", { p_business_id: FIX.businessSell, p_product_id: ownerListingId, p_status: "archived" });
    assert("LIST-04", "Archive (STAFF)", arc.ok && (await readProduct(ownerListingId)).status === "archived", arc.message);

    const editArchived = await rpc(owner, "update_business_listing", {
      p_business_id: FIX.businessSell,
      p_product_id: ownerListingId,
      p_name: "Archived Peppers",
      p_category_id: FIX.category,
      p_description: null,
      p_price_per_unit: 135.5,
      p_unit: "kg",
      p_min_order_quantity: 3,
      p_harvest_date: null,
      p_available_until: null,
      p_status: "active",
    });
    assert("LIST-04b", "Editing an archived listing keeps it archived", editArchived.ok && (await readProduct(ownerListingId)).status === "archived", editArchived.message);

    const restore = await rpc(owner, "set_business_listing_status", { p_business_id: FIX.businessSell, p_product_id: ownerListingId, p_status: "draft" });
    assert("LIST-05", "Restore archived → draft", restore.ok && (await readProduct(ownerListingId)).status === "draft", restore.message);
  }
  {
    // Admin moderation contract: moderation_status + non-active status in the same UPDATE.
    await adminClient.from("products").update({ moderation_status: "flagged", status: "draft" }).eq("id", FIX.pModerated);
    const pub = await rpc(owner, "set_business_listing_status", { p_business_id: FIX.businessSell, p_product_id: FIX.pModerated, p_status: "active" });
    assert("LIST-06", "Producer cannot publish a flagged listing", !pub.ok && pub.code === "UMC01", `${pub.code} ${pub.message}`);
    const viaEdit = await rpc(staff, "update_business_listing", {
      p_business_id: FIX.businessSell,
      p_product_id: FIX.pModerated,
      p_name: "Moderated Basil",
      p_category_id: FIX.category,
      p_description: null,
      p_price_per_unit: 100,
      p_unit: "kg",
      p_min_order_quantity: 1,
      p_harvest_date: null,
      p_available_until: null,
      p_status: "active",
    });
    assert("LIST-06b", "Producer cannot publish a flagged listing through an edit", !viaEdit.ok && viaEdit.code === "UMC01", `${viaEdit.code} ${viaEdit.message}`);
    const { error: directErr } = await owner.from("products").update({ moderation_status: "approved" }).eq("id", FIX.pModerated);
    assert("LIST-06c", "Producer cannot clear moderation directly", Boolean(directErr), directErr?.message ?? "no error");
    const arc = await rpc(owner, "set_business_listing_status", { p_business_id: FIX.businessSell, p_product_id: FIX.pModerated, p_status: "archived" });
    const p = await readProduct(FIX.pModerated);
    assert("LIST-06d", "Producer may still archive a flagged listing; moderation untouched", arc.ok && p.status === "archived" && p.moderation_status === "flagged", `${p.status}/${p.moderation_status}`);
    await adminClient.from("products").update({ moderation_status: "suspended", status: "archived" }).eq("id", FIX.pModerated);
    const pub2 = await rpc(owner, "set_business_listing_status", { p_business_id: FIX.businessSell, p_product_id: FIX.pModerated, p_status: "active" });
    assert("LIST-06e", "Producer cannot publish a suspended listing", !pub2.ok && pub2.code === "UMC01", `${pub2.code} ${pub2.message}`);
    const inv = await adjust(owner, FIX.businessSell, FIX.pModerated, "RECEIVED", 5);
    assert("LIST-06f", "Stock of a moderated listing can still be managed", inv.ok, inv.message);
  }
  {
    const zeroPrice = await rpc(owner, "create_business_listing", listingArgs(FIX.businessSell, { p_price_per_unit: 0 }));
    assert("LIST-07", "Server rejects zero price", !zeroPrice.ok && zeroPrice.code === "UMV01", `${zeroPrice.code} ${zeroPrice.message}`);
    const badUnit = await rpc(owner, "create_business_listing", listingArgs(FIX.businessSell, { p_unit: "truckload" }));
    assert("LIST-07b", "Server rejects unknown unit", !badUnit.ok && badUnit.code === "UMV01", `${badUnit.code} ${badUnit.message}`);
    const archivedCreate = await rpc(owner, "create_business_listing", listingArgs(FIX.businessSell, { p_status: "archived" }));
    assert("LIST-07c", "Server rejects creating as archived", !archivedCreate.ok && archivedCreate.code === "UMV01");
    const negStock = await rpc(owner, "create_business_listing", listingArgs(FIX.businessSell, { p_opening_quantity: -5 }));
    assert("LIST-07d", "Server rejects negative opening stock", !negStock.ok && negStock.code === "UMV01");
    const foreignImage = await rpc(staff, "create_business_listing", listingArgs(FIX.businessSell, {
      p_image_paths: [`products/${PERSONAS.farmerB}/0f0f0f0f-0000-4000-8000-000000000000.webp`],
    }));
    assert("LIST-07e", "Server rejects a photo from someone else's storage folder", !foreignImage.ok && foreignImage.code === "UMV01", `${foreignImage.code} ${foreignImage.message}`);
    const ownImage = await rpc(staff, "create_business_listing", listingArgs(FIX.businessSell, {
      p_name: "Photo Listing",
      p_image_paths: [`products/${PERSONAS.buyerB}/0f0f0f0f-0000-4000-8000-000000000001.webp`],
    }));
    assert("LIST-07f", "Photo from the caller's own folder is accepted", ownImage.ok, ownImage.message);
    const tooMany = await rpc(owner, "create_business_listing", listingArgs(FIX.businessSell, {
      p_image_paths: Array.from({ length: 6 }, (_, i) => `products/${PERSONAS.farmerA}/img-${i}.webp`),
    }));
    assert("LIST-07g", "Server rejects more than 5 photos", !tooMany.ok && tooMany.code === "UMV01");
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("3. Inventory — receive, loss, count correction, negative stock");
  // ══════════════════════════════════════════════════════════════════════════

  {
    await setStock(FIX.pLoss, 100);
    const r = await adjust(owner, FIX.businessSell, FIX.pLoss, "RECEIVED", 12.5, { reason: "Morning harvest" });
    const moves = await movementsOf(FIX.pLoss);
    const last = moves[moves.length - 1];
    assert("INV-01", "Receive adds stock (decimal)", r.ok && (await stockOf(FIX.pLoss)) === 112.5, r.message);
    assert(
      "INV-01b",
      "Receive is recorded with type, reason, actor and resulting balance",
      last?.movement_type === "RECEIVED" && last.quantity_delta === 12.5 && last.balance_after === 112.5 && last.reason === "Morning harvest" && last.created_by === PERSONAS.farmerA && last.business_id === FIX.businessSell,
      JSON.stringify(last)
    );

    const over = await adjust(staff, FIX.businessSell, FIX.pLoss, "SPOILAGE", 200);
    assert("INV-02", "Loss larger than stock is rejected (no negative stock)", !over.ok && over.code === "UMC01" && /112\.5/.test(over.message), `${over.code} ${over.message}`);
    assert("INV-02b", "Rejected loss leaves stock and ledger untouched", (await stockOf(FIX.pLoss)) === 112.5 && (await movementsOf(FIX.pLoss)).length === moves.length);

    const loss = await adjust(staff, FIX.businessSell, FIX.pLoss, "SPOILAGE", 2.5, { reason: "Bruised" });
    assert("INV-03", "Record loss / spoilage", loss.ok && (await stockOf(FIX.pLoss)) === 110, loss.message);

    const stale = await adjust(owner, FIX.businessSell, FIX.pLoss, "ADJUSTMENT", 90, { expected: 112.5 });
    assert("INV-04", "Count correction with a stale balance is rejected", !stale.ok && stale.code === "UMC01" && /110/.test(stale.message), `${stale.code} ${stale.message}`);
    const count = await adjust(owner, FIX.businessSell, FIX.pLoss, "ADJUSTMENT", 90, { expected: 110, reason: "Weekly count" });
    const countMove = (await movementsOf(FIX.pLoss)).pop();
    assert("INV-04b", "Count correction with the current balance applies", count.ok && (await stockOf(FIX.pLoss)) === 90, count.message);
    assert("INV-04c", "Count correction recorded as the signed difference", countMove?.movement_type === "ADJUSTMENT" && countMove.quantity_delta === -20 && countMove.balance_after === 90, JSON.stringify(countMove));
    const same = await adjust(owner, FIX.businessSell, FIX.pLoss, "ADJUSTMENT", 90, { expected: 90 });
    assert("INV-04d", "No-op count is rejected", !same.ok && same.code === "UMV01");
    const noExpected = await adjust(owner, FIX.businessSell, FIX.pLoss, "ADJUSTMENT", 50);
    assert("INV-04e", "Count correction requires the expected balance", !noExpected.ok && noExpected.code === "UMV01");

    const zero = await adjust(owner, FIX.businessSell, FIX.pLoss, "ADJUSTMENT", 0, { expected: 90 });
    assert("INV-05", "Count down to zero (out of stock) allowed", zero.ok && (await stockOf(FIX.pLoss)) === 0, zero.message);
    const lossAtZero = await adjust(owner, FIX.businessSell, FIX.pLoss, "SPOILAGE", 0.01);
    assert("INV-05b", "Any loss at zero stock is rejected", !lossAtZero.ok && lossAtZero.code === "UMC01");

    const negative = await adjust(owner, FIX.businessSell, FIX.pLoss, "RECEIVED", -5);
    assert("INV-06", "Negative quantity rejected server-side", !negative.ok && negative.code === "UMV01");
    const decimals = await adjust(owner, FIX.businessSell, FIX.pLoss, "RECEIVED", 1.234);
    assert("INV-06b", "More than 2 decimals rejected server-side", !decimals.ok && decimals.code === "UMV01");
    const sold = await adjust(owner, FIX.businessSell, FIX.pLoss, "SOLD", 5);
    assert("INV-06c", "Clients cannot record SOLD/RELEASED movements", !sold.ok && sold.code === "UMV01");
    const huge = await adjust(owner, FIX.businessSell, FIX.pLoss, "RECEIVED", 99_999_999.99);
    const huge2 = await adjust(owner, FIX.businessSell, FIX.pLoss, "RECEIVED", 1);
    assert("INV-06d", "Stock ceiling enforced without overflow errors", huge.ok && !huge2.ok && huge2.code === "UMV01", `${huge.message} | ${huge2.code} ${huge2.message}`);
    await setStock(FIX.pLoss, 0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("4. LIVE concurrency — two members of the same business");
  // ══════════════════════════════════════════════════════════════════════════

  {
    // RACE-01: 20 simultaneous +1 receipts split between OWNER and STAFF.
    await setStock(FIX.pRace, 100);
    const since = await dbNow();
    const attempts = await Promise.all(
      Array.from({ length: 20 }, (_, i) => adjust(i % 2 === 0 ? owner : staff, FIX.businessSell, FIX.pRace, "RECEIVED", 1))
    );
    const okCount = attempts.filter((a) => a.ok).length;
    const final = await stockOf(FIX.pRace);
    const raceMoves = (await movementsOf(FIX.pRace, since)).filter((m) => m.movement_type === "RECEIVED");
    const balances = raceMoves.map((m) => m.balance_after).sort((a, b) => a - b);
    const expectedBalances = Array.from({ length: 20 }, (_, i) => 101 + i);
    assert("RACE-01", "20 concurrent receipts all succeed", okCount === 20, attempts.filter((a) => !a.ok).map((a) => a.message).join(" | "));
    assert("RACE-01b", "No lost update: final balance = 100 + 20", final === 120, `final=${final}`);
    assert(
      "RACE-01c",
      "Ledger proves serialization: balances 101..120, each exactly once",
      JSON.stringify(balances) === JSON.stringify(expectedBalances),
      JSON.stringify(balances)
    );
  }
  {
    // RACE-02: OWNER and STAFF each record a 60 kg loss on 100 kg at the same instant.
    await setStock(FIX.pLoss, 100);
    const [a, b] = await Promise.all([
      adjust(owner, FIX.businessSell, FIX.pLoss, "SPOILAGE", 60),
      adjust(staff, FIX.businessSell, FIX.pLoss, "SPOILAGE", 60),
    ]);
    const final = await stockOf(FIX.pLoss);
    assert("RACE-02", "Conflicting losses: exactly one succeeds", [a, b].filter((r) => r.ok).length === 1, `${a.ok}:${a.message} | ${b.ok}:${b.message}`);
    assert("RACE-02b", "Loser fails cleanly with the stock conflict", [a, b].some((r) => !r.ok && r.code === "UMC01"));
    assert("RACE-02c", "No negative stock: final = 40", final === 40, `final=${final}`);
  }
  {
    // RACE-03: both members submit a count based on the same 100 kg reading.
    await setStock(FIX.pCount, 100);
    const [a, b] = await Promise.all([
      adjust(owner, FIX.businessSell, FIX.pCount, "ADJUSTMENT", 70, { expected: 100 }),
      adjust(staff, FIX.businessSell, FIX.pCount, "ADJUSTMENT", 90, { expected: 100 }),
    ]);
    const final = await stockOf(FIX.pCount);
    const winner = a.ok ? 70 : b.ok ? 90 : null;
    assert("RACE-03", "Conflicting counts: exactly one succeeds", [a, b].filter((r) => r.ok).length === 1, `${a.ok}:${a.message} | ${b.ok}:${b.message}`);
    assert("RACE-03b", "Stale count rejected, not silently applied", [a, b].some((r) => !r.ok && r.code === "UMC01"));
    assert("RACE-03c", "Final balance is exactly the winning count", winner !== null && final === winner, `final=${final} winner=${winner}`);
  }
  {
    // RACE-04: 10 receipts of +5 and 10 losses of −3 interleaved, starting at 50.
    await setStock(FIX.pBurst, 50);
    const attempts = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        i % 2 === 0
          ? adjust(owner, FIX.businessSell, FIX.pBurst, "RECEIVED", 5)
          : adjust(staff, FIX.businessSell, FIX.pBurst, "SPOILAGE", 3)
      )
    );
    const final = await stockOf(FIX.pBurst);
    assert("RACE-04", "Mixed burst: every movement applied", attempts.every((r) => r.ok), attempts.filter((r) => !r.ok).map((r) => r.message).join(" | "));
    assert("RACE-04b", "Deterministic final balance 50 + 50 − 30 = 70", final === 70, `final=${final}`);
  }
  let raceOrderId: string | null = null;
  {
    // RACE-05: a buyer checks out 70 kg while STAFF records a 50 kg loss on 100 kg.
    await setStock(FIX.pCheckout, 100);
    await adminClient.from("cart_items").delete().eq("business_id", FIX.businessBoth);
    await adminClient.from("cart_items").insert({
      business_id: FIX.businessBoth,
      business_clerk_id: PERSONAS.buyerA,
      product_id: FIX.pCheckout,
      quantity: 70,
    });
    const [checkout, loss] = await Promise.all([
      rpc(bothOwner, "place_v4_checkout_orders", {
        p_business_id: FIX.businessBoth,
        p_orders: [
          {
            farmer_clerk_id: PERSONAS.farmerA,
            fulfillment_type: "pickup",
            pickup_date: tomorrow,
            items: [{ product_id: FIX.pCheckout, quantity: 70 }],
          },
        ],
      }),
      adjust(staff, FIX.businessSell, FIX.pCheckout, "SPOILAGE", 50),
    ]);
    const final = await stockOf(FIX.pCheckout);
    assert("RACE-05", "Checkout vs. loss: exactly one succeeds", [checkout, loss].filter((r) => r.ok).length === 1, `checkout=${checkout.ok}:${checkout.message} | loss=${loss.ok}:${loss.message}`);
    assert("RACE-05b", "Final balance matches the winner (30 or 50), never negative", (checkout.ok && final === 30) || (loss.ok && final === 50), `final=${final}`);
    if (checkout.ok) {
      raceOrderId = ((checkout.data as { order_ids?: string[] })?.order_ids ?? [])[0] ?? null;
    }
  }
  {
    const products = [FIX.pRace, FIX.pLoss, FIX.pCount, FIX.pBurst, FIX.pCheckout, FIX.pAuth, FIX.pBoth, FIX.pModerated];
    const checks = await Promise.all(products.map((p) => ledgerMatchesBalance(p)));
    const broken = checks.map((c, i) => ({ ...c, product: products[i] })).filter((c) => !c.ok);
    assert("RACE-06", "Ledger invariant SUM(delta) = balance holds for every fixture product", broken.length === 0, JSON.stringify(broken));
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("5. Checkout compatibility");
  // ══════════════════════════════════════════════════════════════════════════

  {
    await setStock(FIX.pCheckout, 100);
    await adminClient.from("cart_items").delete().eq("business_id", FIX.businessBoth);
    await adminClient.from("cart_items").insert({
      business_id: FIX.businessBoth,
      business_clerk_id: PERSONAS.buyerA,
      product_id: FIX.pCheckout,
      quantity: 10,
    });
    const since = await dbNow();
    const checkout = await rpc(bothOwner, "place_v4_checkout_orders", {
      p_business_id: FIX.businessBoth,
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA,
          fulfillment_type: "pickup",
          pickup_date: tomorrow,
          items: [{ product_id: FIX.pCheckout, quantity: 10 }],
        },
      ],
    });
    const orderId = ((checkout.data as { order_ids?: string[] })?.order_ids ?? [])[0];
    assert("CHK-01", "V4 checkout still succeeds and decrements stock", checkout.ok && (await stockOf(FIX.pCheckout)) === 90, checkout.message);
    const sold = (await movementsOf(FIX.pCheckout, since)).find((m) => m.movement_type === "SOLD");
    assert(
      "CHK-01b",
      "Sale recorded as SOLD −10 referencing its order, in the same transaction",
      sold?.quantity_delta === -10 && sold.balance_after === 90 && sold.reference_type === "order" && sold.reference_id === orderId,
      JSON.stringify(sold)
    );

    const cancel = await rpc(owner, "update_order_status", {
      p_order_id: orderId,
      p_new_status: "cancelled",
      p_cancellation_reason: "verify-v4-producer-ops-live",
    });
    const released = (await movementsOf(FIX.pCheckout, since)).find((m) => m.movement_type === "RELEASED");
    assert("CHK-02", "Seller cancellation still restores stock", cancel.ok && (await stockOf(FIX.pCheckout)) === 100, cancel.message);
    assert(
      "CHK-02b",
      "Restock recorded as RELEASED +10 referencing the order",
      released?.quantity_delta === 10 && released.balance_after === 100 && released.reference_id === orderId,
      JSON.stringify(released)
    );

    await adminClient.from("cart_items").delete().eq("business_id", FIX.businessBoth);
    await adminClient.from("cart_items").insert({
      business_id: FIX.businessBoth,
      business_clerk_id: PERSONAS.buyerA,
      product_id: FIX.pCheckout,
      quantity: 150,
    });
    const tooMuch = await rpc(bothOwner, "place_v4_checkout_orders", {
      p_business_id: FIX.businessBoth,
      p_orders: [
        {
          farmer_clerk_id: PERSONAS.farmerA,
          fulfillment_type: "pickup",
          pickup_date: tomorrow,
          items: [{ product_id: FIX.pCheckout, quantity: 150 }],
        },
      ],
    });
    assert("CHK-03", "Checkout stock validation unchanged (oversell rejected)", !tooMuch.ok && /insufficient stock/i.test(tooMuch.message), tooMuch.message);
    assert("CHK-03b", "Rejected checkout leaves stock untouched", (await stockOf(FIX.pCheckout)) === 100);
    const inv = await ledgerMatchesBalance(FIX.pCheckout);
    assert("CHK-04", "Ledger invariant holds through checkout and cancellation", inv.ok, JSON.stringify(inv));
    if (raceOrderId) console.log(`  (RACE-05 checkout won; order ${raceOrderId} is removed in cleanup)`);
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
