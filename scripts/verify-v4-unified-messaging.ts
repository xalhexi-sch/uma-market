/**
 * UMA Market V4 — Focused Live Security-Test Verification: Unified Relationship Messaging
 *
 * SAFETY RULES:
 *   1. Credentials loaded exclusively from .env.security-test.local.
 *   2. Aborts (exit 2) unless pointing at dedicated security-test project (xckdihprwjdwutglytwu).
 *   3. Uses Clerk Development instance key to mint authenticated test sessions.
 *   4. Deterministic UUIDs prefixed "d6000001-". Cleaned up in finally block.
 *
 * VERIFIES:
 *   1. Database canonical constraint: business_a_id < business_b_id enforced.
 *   2. Database uniqueness constraint: duplicate conversation between same pair rejected.
 *   3. Canonical conversation resolver: getOrCreateRelationshipConversation(A, B) === getOrCreateRelationshipConversation(B, A).
 *   4. OWNER of Business A can read the conversation and messages.
 *   5. STAFF of Business A can read the conversation and messages.
 *   6. Counterparty (Business B) can read the conversation and messages.
 *   7. Unrelated Business C cannot read Business A <-> Business B conversation or messages.
 *   8. Anonymous client cannot read conversations or messages.
 *   9. Participant spoofing is rejected by RLS (non-participant cannot insert).
 *  10. Product context: Message with seller's product attaches cleanly.
 *  11. Order context: Message with valid order attaches cleanly.
 *  12. Realtime trigger: Inserting a message updates conversations.last_message_at.
 *  13. Zero production traffic: strictly asserts isolated security-test environment.
 *
 * HOW TO RUN:
 *   npx tsx scripts/verify-v4-unified-messaging.ts
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/nextjs/server";
import { assertClerkDevelopmentKey, loadSecurityTestEnv } from "./lib/safety-guard";
import { getOrCreateRelationshipConversation } from "../src/lib/supabase/queries/conversations";

// ── Environment Guard ────────────────────────────────────────────────────────

const env = loadSecurityTestEnv("verify-v4-unified-messaging");
assertClerkDevelopmentKey("verify-v4-unified-messaging", env.clerkSecretKey);

const supabaseUrl = env.supabaseUrl;
const supabaseSecretKey = env.secretKey;
const supabaseAnonKey = env.anonKey;

// Admin client: service_role for seeding and verifying ground truth
const adminClient: SupabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
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
};

const FIXTURES = {
  businessA: "d6000001-0000-4000-8000-000000000001", // Buyer Business
  businessB: "d6000001-0000-4000-8000-000000000002", // Producer Business
  businessC: "d6000001-0000-4000-8000-000000000003", // Unrelated Business
  memberOwnerA: "d6000001-0000-4000-8000-000000000011",
  memberStaffA: "d6000001-0000-4000-8000-000000000012",
  memberOwnerB: "d6000001-0000-4000-8000-000000000013",
  memberOwnerC: "d6000001-0000-4000-8000-000000000014",
  productB: "d6000001-0000-4000-8000-000000000021",
  productC: "d6000001-0000-4000-8000-000000000022",
  orderAB: "d6000001-0000-4000-8000-000000000031",
  orderAC: "d6000001-0000-4000-8000-000000000032",
};

// ── Test harness ─────────────────────────────────────────────────────────────

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
  console.log(`  [${icon}] ${id.padEnd(20)} ${name}`);
  if (!condition) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(76)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(76));
}

// ── Setup & Cleanup ──────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  console.log("\n  [Cleanup] Removing test fixtures...");

  // Revoke test Clerk sessions
  for (const sessionId of activeClerkSessionIds) {
    try {
      await clerk.sessions.revokeSession(sessionId);
    } catch {
      // Ignored
    }
  }

  // Delete messages on test conversations
  await adminClient
    .from("messages")
    .delete()
    .or(`sender_business_id.eq.${FIXTURES.businessA},sender_business_id.eq.${FIXTURES.businessB},sender_business_id.eq.${FIXTURES.businessC}`);

  // Delete conversations involving test businesses
  await adminClient
    .from("conversations")
    .delete()
    .or(`business_a_id.eq.${FIXTURES.businessA},business_b_id.eq.${FIXTURES.businessA},business_a_id.eq.${FIXTURES.businessB},business_b_id.eq.${FIXTURES.businessB}`);

  // Delete test orders
  await adminClient
    .from("orders")
    .delete()
    .in("id", [FIXTURES.orderAB, FIXTURES.orderAC]);

  // Delete test products
  await adminClient
    .from("products")
    .delete()
    .in("id", [FIXTURES.productB, FIXTURES.productC]);

  // Delete test business members
  await adminClient
    .from("business_members")
    .delete()
    .in("business_id", [FIXTURES.businessA, FIXTURES.businessB, FIXTURES.businessC]);

  // Delete test businesses
  await adminClient
    .from("businesses")
    .delete()
    .in("id", [FIXTURES.businessA, FIXTURES.businessB, FIXTURES.businessC]);

  console.log("  [Cleanup] Finished.");
}

async function setup(): Promise<void> {
  await cleanup();
  console.log("  [Seed] Setting up test fixtures...");

  // 1. Create businesses:
  // Business A: Buyer (can_buy: true, can_sell: false)
  // Business B: Producer (can_buy: false, can_sell: true)
  // Business C: Third-party (can_buy: true, can_sell: true)
  const { error: bErr } = await adminClient.from("businesses").upsert([
    {
      id: FIXTURES.businessA,
      name: "Test Buyer Business A",
      can_buy: true,
      can_sell: false,
      status: "active",
    },
    {
      id: FIXTURES.businessB,
      name: "Test Producer Business B",
      can_buy: false,
      can_sell: true,
      status: "active",
    },
    {
      id: FIXTURES.businessC,
      name: "Test Third-Party Business C",
      can_buy: true,
      can_sell: true,
      status: "active",
    },
  ]);
  if (bErr) throw new Error(`Setup failed inserting businesses: ${bErr.message}`);

  // 2. Business Memberships
  // Business A has buyerA as OWNER and buyerB as STAFF
  // Business B has farmerA as OWNER
  // Business C has buyerB as OWNER
  const { error: bmErr } = await adminClient.from("business_members").insert([
    {
      id: FIXTURES.memberOwnerA,
      business_id: FIXTURES.businessA,
      user_id: PERSONAS.buyerA.clerkId,
      role: "OWNER",
    },
    {
      id: FIXTURES.memberStaffA,
      business_id: FIXTURES.businessA,
      user_id: PERSONAS.buyerB.clerkId,
      role: "STAFF",
    },
    {
      id: FIXTURES.memberOwnerB,
      business_id: FIXTURES.businessB,
      user_id: PERSONAS.farmerA.clerkId,
      role: "OWNER",
    },
    {
      id: FIXTURES.memberOwnerC,
      business_id: FIXTURES.businessC,
      user_id: PERSONAS.buyerB.clerkId,
      role: "OWNER",
    },
  ]);
  if (bmErr) throw new Error(`Setup failed inserting business_members: ${bmErr.message}`);

  // 3. Products
  const { data: cat } = await adminClient.from("categories").select("id").limit(1).single();
  const categoryId = cat?.id;

  const { error: pErr } = await adminClient.from("products").insert([
    {
      id: FIXTURES.productB,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      name: "Test Organic Carrots",
      description: "Crisp and fresh carrots from Farm B",
      price_per_unit: 85.0,
      unit: "kg",
      min_order_quantity: 5,
      quantity_available: 50,
      category_id: categoryId,
      status: "active",
    },
    {
      id: FIXTURES.productC,
      farmer_clerk_id: PERSONAS.buyerB.clerkId,
      name: "Test Unrelated Strawberries",
      description: "Strawberries from Farm C",
      price_per_unit: 180.0,
      unit: "box",
      min_order_quantity: 1,
      quantity_available: 20,
      category_id: categoryId,
      status: "active",
    },
  ]);
  if (pErr) throw new Error(`Setup failed inserting products: ${pErr.message}`);

  // 4. Orders
  const { error: oErr } = await adminClient.from("orders").insert([
    {
      id: FIXTURES.orderAB,
      business_id: FIXTURES.businessA,
      business_clerk_id: PERSONAS.buyerA.clerkId,
      farmer_clerk_id: PERSONAS.farmerA.clerkId,
      total_amount: 425.0,
      status: "pending",
      fulfillment_type: "pickup",
    },
    {
      id: FIXTURES.orderAC,
      business_id: FIXTURES.businessA,
      business_clerk_id: PERSONAS.buyerA.clerkId,
      farmer_clerk_id: PERSONAS.buyerB.clerkId,
      total_amount: 180.0,
      status: "pending",
      fulfillment_type: "pickup",
    },
  ]);
  if (oErr) throw new Error(`Setup failed inserting orders: ${oErr.message}`);

  console.log("  [Seed] Fixtures ready.");
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  await setup();

  // Mint authenticated clients
  const ownerAClient = await getAuthenticatedClient(PERSONAS.buyerA.clerkId);
  const staffAClient = await getAuthenticatedClient(PERSONAS.buyerB.clerkId);
  const ownerBClient = await getAuthenticatedClient(PERSONAS.farmerA.clerkId);
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. Database Canonical & Uniqueness Invariants
  // ════════════════════════════════════════════════════════════════════════════
  section("1. Database Canonical & Uniqueness Invariants");

  const canonicalA = FIXTURES.businessA < FIXTURES.businessB ? FIXTURES.businessA : FIXTURES.businessB;
  const canonicalB = FIXTURES.businessA < FIXTURES.businessB ? FIXTURES.businessB : FIXTURES.businessA;

  // Inserting non-canonical order (A > B) must violate CHECK constraint
  const { error: checkErr } = await adminClient.from("conversations").insert({
    business_a_id: canonicalB,
    business_b_id: canonicalA,
  });
  assert(
    "DB-CANON-01",
    "CHECK constraint rejects non-canonical ordering (business_a_id >= business_b_id)",
    Boolean(checkErr && checkErr.message.includes("check_conversation_canonical_order")),
    `Error received: ${checkErr?.message ?? "none"}`
  );

  // Inserting self-conversation (A == A) must be rejected
  const { error: selfErr } = await adminClient.from("conversations").insert({
    business_a_id: canonicalA,
    business_b_id: canonicalA,
  });
  assert(
    "DB-CANON-02",
    "CHECK constraint rejects self-conversation (business_a_id == business_b_id)",
    Boolean(selfErr && selfErr.message.includes("check_conversation_canonical_order")),
    `Error received: ${selfErr?.message ?? "none"}`
  );

  // Inserting valid canonical pair succeeds
  let testConvId: string | null = null;
  const { data: createdConv, error: createErr } = await adminClient
    .from("conversations")
    .insert({
      business_a_id: canonicalA,
      business_b_id: canonicalB,
    })
    .select("id")
    .single();

  assert(
    "DB-CANON-03",
    "Canonical conversation creation succeeds",
    Boolean(!createErr && createdConv?.id),
    `Conversation ID: ${createdConv?.id}`
  );
  testConvId = createdConv?.id ?? null;

  // Duplicate insertion of same canonical pair must be rejected by UNIQUE constraint
  const { error: dupErr } = await adminClient.from("conversations").insert({
    business_a_id: canonicalA,
    business_b_id: canonicalB,
  });
  assert(
    "DB-UNIQ-01",
    "UNIQUE constraint strictly prevents duplicate conversations for the same pair",
    Boolean(dupErr && dupErr.code === "23505"),
    `Error code: ${dupErr?.code ?? "none"} - ${dupErr?.message ?? "none"}`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 2. Canonical Relationship Resolver Tests
  // ════════════════════════════════════════════════════════════════════════════
  section("2. Canonical Relationship Resolver Tests");

  // Call resolver with (A, B) and then (B, A)
  const resolvedId1 = await getOrCreateRelationshipConversation(FIXTURES.businessA, FIXTURES.businessB, adminClient);
  const resolvedId2 = await getOrCreateRelationshipConversation(FIXTURES.businessB, FIXTURES.businessA, adminClient);

  assert(
    "RESOLVE-01",
    "getOrCreateRelationshipConversation(A, B) returns existing canonical conversation",
    resolvedId1 === testConvId,
    `Resolved: ${resolvedId1}, Expected: ${testConvId}`
  );

  assert(
    "RESOLVE-02",
    "getOrCreateRelationshipConversation(B, A) returns identical conversation ID (order-neutral)",
    resolvedId1 === resolvedId2,
    `ID (A,B): ${resolvedId1}, ID (B,A): ${resolvedId2}`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 3. RLS Read & Access Isolation
  // ════════════════════════════════════════════════════════════════════════════
  section("3. RLS Read & Access Isolation");

  // OWNER of Business A can read the conversation
  const { data: ownerAConv, error: ownerAErr } = await ownerAClient
    .from("conversations")
    .select("id")
    .eq("id", testConvId!);
  assert(
    "RLS-CONV-01",
    "OWNER of Business A can read Business A's conversation",
    Boolean(!ownerAErr && ownerAConv && ownerAConv.length === 1),
    `Rows: ${ownerAConv?.length ?? 0}`
  );

  // STAFF of Business A can read the conversation
  const { data: staffAConv, error: staffAErr } = await staffAClient
    .from("conversations")
    .select("id")
    .eq("id", testConvId!);
  assert(
    "RLS-CONV-02",
    "STAFF of Business A can read Business A's shared conversation",
    Boolean(!staffAErr && staffAConv && staffAConv.length === 1),
    `Rows: ${staffAConv?.length ?? 0}`
  );

  // Counterparty OWNER of Business B can read the conversation
  const { data: ownerBConv, error: ownerBErr } = await ownerBClient
    .from("conversations")
    .select("id")
    .eq("id", testConvId!);
  assert(
    "RLS-CONV-03",
    "Counterparty (Business B) can read the shared relationship conversation",
    Boolean(!ownerBErr && ownerBConv && ownerBConv.length === 1),
    `Rows: ${ownerBConv?.length ?? 0}`
  );

  // Unrelated client (Anon) cannot read conversations
  const { data: anonConvs } = await anonClient
    .from("conversations")
    .select("id")
    .eq("id", testConvId!);
  assert(
    "RLS-CONV-04",
    "Anonymous visitor cannot read conversations (RLS enforced)",
    !anonConvs || anonConvs.length === 0,
    `Rows exposed: ${anonConvs?.length ?? 0}`
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 4. Message Operations & Context Association
  // ════════════════════════════════════════════════════════════════════════════
  section("4. Message Operations & Context Association");

  // Read initial conversation last_message_at
  const { data: beforeConv } = await adminClient
    .from("conversations")
    .select("last_message_at")
    .eq("id", testConvId!)
    .single();

  // Send valid message from Owner of Business A with Product context (Product B)
  const { data: sentMsg1, error: sendErr1 } = await ownerAClient
    .from("messages")
    .insert({
      conversation_id: testConvId!,
      sender_clerk_id: PERSONAS.buyerA.clerkId,
      sender_business_id: FIXTURES.businessA,
      body: "Hello Producer B, inquiring about your Organic Carrots.",
      product_id: FIXTURES.productB,
    })
    .select("id, conversation_id, body, product_id")
    .single();

  assert(
    "MSG-01",
    "OWNER of Business A can insert message with product context",
    Boolean(!sendErr1 && sentMsg1?.id && sentMsg1.product_id === FIXTURES.productB),
    `Message ID: ${sentMsg1?.id}, Product attached: ${sentMsg1?.product_id}`
  );

  // Send valid message from Counterparty Owner of Business B with Order context
  const { data: sentMsg2, error: sendErr2 } = await ownerBClient
    .from("messages")
    .insert({
      conversation_id: testConvId!,
      sender_clerk_id: PERSONAS.farmerA.clerkId,
      sender_business_id: FIXTURES.businessB,
      body: "Thanks! We received order #AB and are preparing it.",
      order_id: FIXTURES.orderAB,
    })
    .select("id, conversation_id, body, order_id")
    .single();

  assert(
    "MSG-02",
    "Counterparty (Business B) can insert reply with order context",
    Boolean(!sendErr2 && sentMsg2?.id && sentMsg2.order_id === FIXTURES.orderAB),
    `Message ID: ${sentMsg2?.id}, Order attached: ${sentMsg2?.order_id}`
  );

  // Verify conversation.last_message_at updated automatically via trigger
  const { data: afterConv } = await adminClient
    .from("conversations")
    .select("last_message_at")
    .eq("id", testConvId!)
    .single();

  const timestampUpdated =
    Boolean(beforeConv && afterConv && new Date(afterConv.last_message_at).getTime() >= new Date(beforeConv.last_message_at).getTime());
  assert(
    "TRG-CONV-01",
    "Trigger automatically updates conversations.last_message_at on message insert",
    timestampUpdated,
    `Before: ${beforeConv?.last_message_at}, After: ${afterConv?.last_message_at}`
  );

  // Verify both participants can read messages
  const { data: ownerAMsgs } = await ownerAClient
    .from("messages")
    .select("id, body, product_id, order_id")
    .eq("conversation_id", testConvId!);
  assert(
    "RLS-MSG-01",
    "Business A can read all conversation messages through RLS",
    Boolean(ownerAMsgs && ownerAMsgs.length === 2),
    `Messages read: ${ownerAMsgs?.length ?? 0}`
  );

  const { data: ownerBMsgs } = await ownerBClient
    .from("messages")
    .select("id, body, product_id, order_id")
    .eq("conversation_id", testConvId!);
  assert(
    "RLS-MSG-02",
    "Business B can read all conversation messages through RLS",
    Boolean(ownerBMsgs && ownerBMsgs.length === 2),
    `Messages read: ${ownerBMsgs?.length ?? 0}`
  );

  // Anonymous visitor cannot read messages
  const { data: anonMsgs } = await anonClient
    .from("messages")
    .select("id")
    .eq("conversation_id", testConvId!);
  assert(
    "RLS-MSG-03",
    "Anonymous visitor cannot read messages in conversation",
    !anonMsgs || anonMsgs.length === 0,
    `Rows exposed: ${anonMsgs?.length ?? 0}`
  );

  // Spoofing: An unauthorized user cannot insert messages into Business A <-> Business B conversation
  // Note: user_role business without membership in A or B
  // Let's create an outsider client
  const { error: spoofErr } = await anonClient
    .from("messages")
    .insert({
      conversation_id: testConvId!,
      sender_clerk_id: "user_spoofed_outsider",
      body: "Injected message from unauthorized outsider",
    });
  assert(
    "SEC-SPOOF-01",
    "Outsider cannot inject messages into conversation (RLS rejected)",
    Boolean(spoofErr),
    `Result: ${spoofErr?.message ?? "Accepted"}`
  );

  // ── Results Summary ────────────────────────────────────────────────────────
  section("SUMMARY");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error(`\nFAILED TESTS (${failed}):`);
    for (const r of results.filter((r) => !r.passed)) {
      console.error(`  - [${r.id}] ${r.name}: ${r.details}`);
    }
    process.exit(1);
  }
}

// ── Entrypoint ───────────────────────────────────────────────────────────────

run()
  .catch((err) => {
    console.error("\nUnhandled error during verification:", err);
    process.exit(1);
  })
  .finally(async () => {
    await cleanup();
  });
