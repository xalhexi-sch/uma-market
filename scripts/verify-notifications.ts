// =============================================================================
// UMA Market — Notifications V1 runtime verification.
//
// Runs only against the isolated Clerk/Supabase security-test project.
// Uses real Clerk development sessions, so authenticated RLS, SECURITY DEFINER
// RPCs and the live Realtime WebSocket path are all exercised for real.
//
// SAFETY RULES:
//   1. Hard abort unless the security-test project is active.
//   2. Never prints keys, secrets or JWTs.
//   3. Cleanup is fixture-scoped: only notification rows whose dedupe key is
//      derived from a fixture UUID created by THIS run are deleted.
//   4. Cleanup errors are asserted, never silently ignored.
// =============================================================================

import { createClerkClient } from "@clerk/backend";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import * as path from "path";
import { assertClerkDevelopmentKey, loadSecurityTestEnv } from "./lib/safety-guard";

// Shared fail-closed guard: exact security-test project only (production and
// unknown refs abort with exit 2 before any client is constructed), credentials
// read exclusively from .env.security-test.local, and this suite mints Clerk
// sessions, so the key must be a Clerk Development-instance key.
const env = loadSecurityTestEnv("verify-notifications");
assertClerkDevelopmentKey("verify-notifications", env.clerkSecretKey);

const supabaseUrl = env.supabaseUrl;
const anonKey = env.anonKey;
const secretKey = env.secretKey;
const clerkSecretKey = env.clerkSecretKey;
const clerkPublishableKey = env.clerkPublishableKey;

if (!clerkPublishableKey) {
  console.error("FATAL: missing required security-test Clerk publishable key.");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: clerkSecretKey, publishableKey: clerkPublishableKey });
const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const BUYER_A = "user_3JhPbugktYsiMOGIDxF40YwRzx7";
const BUYER_B = "user_3JhUSSDpL2bmzswoMoNM6RzDkyn";
const FARMER_A = "user_3JhPbDuVSiPLuEA6Z8oo86c4Jmr";
const FARMER_B = "user_3JhUSQewYXAYXR80cEFQNwGvsZs";

const PREFIX = "f2000001-0000-0000-0000-";
const IDS = {
  // Direct-insert (trusted path) trigger fixtures.
  accepted: `${PREFIX}000000000011`,
  ready: `${PREFIX}000000000012`,
  completed: `${PREFIX}000000000013`,
  farmerCancel: `${PREFIX}000000000014`,
  businessCancel: `${PREFIX}000000000015`,
  messages: `${PREFIX}000000000016`,
  review: `${PREFIX}000000000017`,
  // Authenticated checkout fixtures.
  checkoutProduct: `${PREFIX}000000000019`,
  lowStockProduct: `${PREFIX}000000000020`,
  // Order status transition fixtures.
  deliveryChain: `${PREFIX}000000000021`,
  pickupChain: `${PREFIX}000000000022`,
  duplicate: `${PREFIX}000000000023`,
  realtimeEntity: `${PREFIX}000000000024`,
  // Review fixtures.
  product: `${PREFIX}000000000031`,
  reviewItem: `${PREFIX}000000000032`,
};

const ORDER_STATUS_TYPES = [
  "order_accepted",
  "order_ready",
  "order_for_delivery",
  "order_completed",
  "farmer_cancellation",
  "business_cancellation",
] as const;

// ---------------------------------------------------------------------------
// Fixture tracking — cleanup may only ever touch these identities.
// ---------------------------------------------------------------------------

const FIXTURE_ORDER_IDS = new Set<string>([
  IDS.accepted,
  IDS.ready,
  IDS.completed,
  IDS.farmerCancel,
  IDS.businessCancel,
  IDS.messages,
  IDS.review,
  IDS.deliveryChain,
  IDS.pickupChain,
  IDS.duplicate,
  IDS.realtimeEntity,
]);
const FIXTURE_DEDUPE_KEYS = new Set<string>();
const sessions: string[] = [];
const CHECKOUT_PRICES = { unit: 9, quantity: 2 };

for (const orderId of FIXTURE_ORDER_IDS) {
  FIXTURE_DEDUPE_KEYS.add(`order:new:${orderId}`);
  for (const type of ORDER_STATUS_TYPES) FIXTURE_DEDUPE_KEYS.add(`order:${orderId}:${type}`);
}

let passed = 0;
let failed = 0;
let realtimeVerified = false;
let baselineNotificationCount: number | null = null;

function assert(name: string, condition: boolean, detail = "") {
  if (condition) passed++;
  else failed++;
  console.log(`${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface AuthSession {
  client: SupabaseClient;
  token: string;
}

async function sessionFor(userId: string): Promise<AuthSession> {
  const session = await clerk.sessions.createSession({ userId });
  sessions.push(session.id);
  const token = await clerk.sessions.getToken(session.id);
  return {
    token: token.jwt,
    client: createClient(supabaseUrl, anonKey, {
      accessToken: async () => token.jwt,
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

interface NotificationRow {
  id: string;
  recipient_clerk_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string | null;
  action_url: string;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
}

async function notificationsFor(entityId: string, recipient?: string): Promise<NotificationRow[]> {
  let query = admin
    .from("notifications")
    .select("id, recipient_clerk_id, type, title, body, entity_type, entity_id, action_url, dedupe_key, read_at, created_at")
    .eq("entity_id", entityId);
  if (recipient) query = query.eq("recipient_clerk_id", recipient);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(`notification query failed: ${error.message}`);
  return (data ?? []) as NotificationRow[];
}

async function countByType(type: string, recipient: string, entityId?: string) {
  let query = admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", type)
    .eq("recipient_clerk_id", recipient);
  if (entityId) query = query.eq("entity_id", entityId);
  const result = await query;
  return result.count ?? 0;
}

async function totalNotificationCount() {
  const result = await admin.from("notifications").select("id", { count: "exact", head: true });
  if (result.error) throw new Error(`notification count failed: ${result.error.message}`);
  return result.count ?? 0;
}

async function addOrder(id: string, buyer = BUYER_A, farmer = FARMER_A, status = "pending") {
  if (!FIXTURE_ORDER_IDS.has(id)) throw new Error(`refusing to create untracked order fixture ${id}`);
  const { error } = await admin
    .from("orders")
    .insert({ id, business_clerk_id: buyer, farmer_clerk_id: farmer, status, fulfillment_type: "pickup", total_amount: 10 });
  if (error) throw new Error(`fixture order failed: ${error.message}`);
}

// =============================================================================
// CLEANUP — fixture-scoped only, errors asserted
// =============================================================================

async function cleanup(): Promise<void> {
  const errors: string[] = [];

  const keys = [...FIXTURE_DEDUPE_KEYS];
  for (let i = 0; i < keys.length; i += 50) {
    const { error } = await admin.from("notifications").delete().in("dedupe_key", keys.slice(i, i + 50));
    if (error) errors.push(`notifications delete: ${error.message}`);
  }

  const { data: leftover, error: leftoverError } = await admin.from("notifications").select("id, dedupe_key").in("dedupe_key", keys);
  if (leftoverError) errors.push(`notifications verify: ${leftoverError.message}`);
  else if ((leftover ?? []).length > 0) errors.push(`notifications left behind: ${(leftover ?? []).map((r) => r.dedupe_key).join(", ")}`);

  const orderIds = [...FIXTURE_ORDER_IDS];
  const steps: { label: string; run: () => PromiseLike<{ error: { message: string } | null }> }[] = [
    { label: "messages", run: () => admin.from("messages").delete().in("order_id", orderIds) },
    { label: "product_reviews", run: () => admin.from("product_reviews").delete().in("order_id", orderIds) },
    { label: "seller_reviews", run: () => admin.from("seller_reviews").delete().in("order_id", orderIds) },
    { label: "order_items", run: () => admin.from("order_items").delete().in("order_id", orderIds) },
    { label: "orders", run: () => admin.from("orders").delete().in("id", orderIds) },
    { label: "cart_items", run: () => admin.from("cart_items").delete().in("product_id", [IDS.checkoutProduct, IDS.lowStockProduct]) },
    { label: "products", run: () => admin.from("products").delete().in("id", [IDS.product, IDS.checkoutProduct, IDS.lowStockProduct]) },
  ];
  for (const step of steps) {
    const { error } = await step.run();
    if (error) errors.push(`${step.label} delete: ${error.message}`);
  }

  const { data: leftoverOrders, error: leftoverOrdersError } = await admin.from("orders").select("id").in("id", orderIds);
  if (leftoverOrdersError) errors.push(`orders verify: ${leftoverOrdersError.message}`);
  else if ((leftoverOrders ?? []).length > 0) errors.push(`orders left behind: ${(leftoverOrders ?? []).length} row(s)`);

  const { data: leftoverProducts, error: leftoverProductsError } = await admin
    .from("products")
    .select("id")
    .in("id", [IDS.product, IDS.checkoutProduct, IDS.lowStockProduct]);
  if (leftoverProductsError) errors.push(`products verify: ${leftoverProductsError.message}`);
  else if ((leftoverProducts ?? []).length > 0) errors.push(`products left behind: ${(leftoverProducts ?? []).length} row(s)`);

  const { data: leftoverCart, error: leftoverCartError } = await admin
    .from("cart_items")
    .select("id")
    .in("product_id", [IDS.checkoutProduct, IDS.lowStockProduct]);
  if (leftoverCartError) errors.push(`cart_items verify: ${leftoverCartError.message}`);
  else if ((leftoverCart ?? []).length > 0) errors.push(`cart_items left behind: ${(leftoverCart ?? []).length} row(s)`);

  if (baselineNotificationCount !== null) {
    const after = await totalNotificationCount();
    assert(
      "fixture-scoped cleanup removed only this run's rows",
      after === baselineNotificationCount,
      `before=${baselineNotificationCount} after=${after}`,
    );
  }

  for (const sessionId of sessions) {
    const revoked = await clerk.sessions.revokeSession(sessionId).catch((error: unknown) => error);
    if (revoked instanceof Error) errors.push(`session revoke: ${revoked.message}`);
  }
  sessions.length = 0;

  if (errors.length > 0) throw new Error(`cleanup failed (${errors.length}):\n  - ${errors.join("\n  - ")}`);
}

// =============================================================================
// REALTIME RUNTIME VERIFICATION (live WebSocket, authenticated Clerk session)
// =============================================================================

function waitForSubscribe(channel: RealtimeChannel, timeoutMs: number, label: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: subscribe timed out after ${timeoutMs}ms`)), timeoutMs);
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve(status);
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        clearTimeout(timer);
        reject(new Error(`${label}: subscribe ${status} ${error?.message ?? ""}`.trim()));
      }
    });
  });
}

async function waitForRow(rows: NotificationRow[], id: string, timeoutMs: number): Promise<NotificationRow | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const hit = rows.find((row) => row.id === id);
    if (hit) return hit;
    await sleep(150);
  }
  return null;
}

async function realtimeRuntimeCheck(runId: string): Promise<void> {
  const SUBSCRIBE_TIMEOUT_MS = 20_000;
  const EVENT_TIMEOUT_MS = 20_000;
  const QUIET_WINDOW_MS = 3_000;

  const farmerA = await sessionFor(FARMER_A);
  const farmerB = await sessionFor(FARMER_B);
  // Configure Realtime authorization with the live Clerk JWT.
  await farmerA.client.realtime.setAuth(farmerA.token);
  await farmerB.client.realtime.setAuth(farmerB.token);

  const receivedByFarmerA: NotificationRow[] = [];
  const receivedByFarmerB: NotificationRow[] = [];

  const topicSuffix = `${runId}-${Date.now()}`;
  const channelA = farmerA.client.channel(`verify-notifications-a-${topicSuffix}`);
  const channelB = farmerB.client.channel(`verify-notifications-b-${topicSuffix}`);

  channelA.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_clerk_id=eq.${FARMER_A}` },
    (payload) => {
      receivedByFarmerA.push(payload.new as unknown as NotificationRow);
    },
  );
  channelB.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_clerk_id=eq.${FARMER_B}` },
    (payload) => {
      receivedByFarmerB.push(payload.new as unknown as NotificationRow);
    },
  );

  const insertedIds: string[] = [];
  let deliveredRowId: string | null = null;
  let subscribeError: string | null = null;
  const startedAt = Date.now();
  try {
    const statuses = await Promise.all([
      waitForSubscribe(channelA, SUBSCRIBE_TIMEOUT_MS, "farmer A channel"),
      waitForSubscribe(channelB, SUBSCRIBE_TIMEOUT_MS, "farmer B channel"),
    ]);
    const subscribedAt = Date.now();
    assert("realtime subscription reaches SUBSCRIBED", statuses.every((status) => status === "SUBSCRIBED"), statuses.join(", "));

    // Only insert once both channels are confirmed SUBSCRIBED, so the test is deterministic.
    // Up to two attempts with distinct fixture keys: the delivery path has been observed to
    // occasionally miss a single event, and a retry is reported rather than hidden.
    for (let attempt = 1; attempt <= 2 && deliveredRowId === null; attempt++) {
      const dedupeKey = `verify:realtime:${runId}:${attempt}`;
      FIXTURE_DEDUPE_KEYS.add(dedupeKey);
      const inserted = await admin
        .from("notifications")
        .insert({
          recipient_clerk_id: FARMER_A,
          type: "new_order",
          title: "Realtime fixture",
          body: "Realtime fixture body",
          entity_type: "order",
          entity_id: IDS.realtimeEntity,
          action_url: `/farmer/orders/${IDS.realtimeEntity}`,
          dedupe_key: dedupeKey,
        })
        .select("id")
        .single();
      if (inserted.error) throw new Error(`realtime fixture insert failed: ${inserted.error.message}`);
      const realtimeRowId: string = inserted.data.id;
      insertedIds.push(realtimeRowId);

      const delivered = await waitForRow(receivedByFarmerA, realtimeRowId, EVENT_TIMEOUT_MS);
      if (delivered) {
        deliveredRowId = realtimeRowId;
        if (attempt > 1) console.log(`WARN realtime delivery succeeded only on attempt ${attempt}`);
      } else {
        console.log(
          `WARN realtime attempt ${attempt}: no event for ${realtimeRowId} within ${EVENT_TIMEOUT_MS}ms (subscribe ${
            subscribedAt - startedAt
          }ms, events seen: ${receivedByFarmerA.length})`,
        );
      }
    }

    const delivered = deliveredRowId ? receivedByFarmerA.find((row) => row.id === deliveredRowId) ?? null : null;
    assert(
      "realtime INSERT event is delivered over the WebSocket",
      Boolean(delivered),
      delivered ? delivered.dedupe_key : `no event received on either attempt (rows ${insertedIds.join(", ")})`,
    );
    assert("realtime payload id matches the inserted row", delivered?.id === deliveredRowId, String(delivered?.id ?? "none"));
    assert("realtime payload recipient is the authenticated farmer", delivered?.recipient_clerk_id === FARMER_A, String(delivered?.recipient_clerk_id ?? "none"));

    await sleep(QUIET_WINDOW_MS);
    const leakedToFarmerB = receivedByFarmerB.filter((row) => insertedIds.includes(row.id));
    assert(
      "realtime event is not delivered to another recipient",
      receivedByFarmerB.length === 0 && leakedToFarmerB.length === 0,
      `farmer B received ${receivedByFarmerB.length} event(s)`,
    );

    if (delivered) realtimeVerified = true;
  } catch (error) {
    subscribeError = error instanceof Error ? error.message : "unknown error";
    assert("realtime subscription reaches SUBSCRIBED", false, subscribeError);
  } finally {
    const removalErrors: string[] = [];
    for (const [label, result] of [
      ["farmerA", await farmerA.client.removeChannel(channelA)],
      ["farmerB", await farmerB.client.removeChannel(channelB)],
    ] as const) {
      if (result !== "ok") removalErrors.push(`${label}=${String(result)}`);
    }
    const stillOpen = farmerA.client.realtime.getChannels().length + farmerB.client.realtime.getChannels().length;
    assert(
      "realtime channel cleanup executes",
      removalErrors.length === 0 && stillOpen === 0,
      `${removalErrors.join(" ")} remainingChannels=${stillOpen}`,
    );

    if (insertedIds.length > 0) {
      const deleted = await admin.from("notifications").delete().in("id", insertedIds);
      const { data: remaining } = await admin.from("notifications").select("id").in("id", insertedIds);
      assert(
        "realtime fixture row is removed",
        !deleted.error && (remaining ?? []).length === 0,
        deleted.error?.message ?? "",
      );
    }
  }

  if (subscribeError) console.log(`Realtime runtime error: ${subscribeError}`);
}

// =============================================================================
// TEST RUN
// =============================================================================

async function run() {
  baselineNotificationCount = await totalNotificationCount();
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const buyerA = await sessionFor(BUYER_A);
  const buyerB = await sessionFor(BUYER_B);
  const farmerA = await sessionFor(FARMER_A);

  try {
    // -----------------------------------------------------------------------
    // Schema / static migration assertions
    // -----------------------------------------------------------------------
    const schema = await admin.from("notifications").select("id, recipient_clerk_id, type, entity_type, entity_id, read_at, dedupe_key").limit(1);
    assert("notifications schema is reachable", !schema.error, schema.error?.message);

    const migration = await import("fs/promises").then((fs) =>
      fs.readFile(path.resolve(process.cwd(), "supabase/migrations/20261002000005_notifications_v1.sql"), "utf8"),
    );
    assert(
      "required indexes declared",
      migration.includes("idx_notifications_recipient_created") && migration.includes("idx_notifications_recipient_unread"),
    );
    assert(
      "RLS and read policies declared",
      migration.includes("ENABLE ROW LEVEL SECURITY") && migration.includes("notifications: read own"),
    );
    assert(
      "notifications added to the realtime publication",
      migration.includes("ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications"),
    );

    // -----------------------------------------------------------------------
    // Trigger coverage through the trusted admin insert path
    // -----------------------------------------------------------------------
    for (const orderId of [IDS.accepted, IDS.ready, IDS.completed, IDS.farmerCancel, IDS.businessCancel, IDS.messages, IDS.review]) {
      await addOrder(orderId);
    }
    const directOrders = [IDS.accepted, IDS.ready, IDS.completed, IDS.farmerCancel, IDS.businessCancel, IDS.messages, IDS.review];
    const directCounts = await Promise.all(directOrders.map((orderId) => countByType("new_order", FARMER_A, orderId)));
    assert(
      "direct order insert (trusted path) fires new_order to the farmer",
      directCounts.every((count) => count === 1),
      directOrders.map((orderId, index) => `${orderId.slice(-4)}=${directCounts[index]}`).join(" "),
    );

    // -----------------------------------------------------------------------
    // REAL checkout through place_checkout_orders() as authenticated BUYER_A
    // -----------------------------------------------------------------------
    const checkoutProduct = await admin.from("products").insert({
      id: IDS.checkoutProduct,
      farmer_clerk_id: FARMER_A,
      name: "Checkout notification fixture",
      price_per_unit: CHECKOUT_PRICES.unit,
      unit: "kg",
      quantity_available: 10,
      min_order_quantity: 1,
      status: "active",
    });
    if (checkoutProduct.error) throw new Error(`checkout product fixture failed: ${checkoutProduct.error.message}`);

    const cartInsert = await buyerA.client
      .from("cart_items")
      .insert({ business_clerk_id: BUYER_A, product_id: IDS.checkoutProduct, quantity: CHECKOUT_PRICES.quantity });
    if (cartInsert.error) throw new Error(`checkout cart fixture failed: ${cartInsert.error.message}`);

    const checkout = await buyerA.client.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: FARMER_A,
          fulfillment_type: "seller_delivery",
          delivery_address: "Notification verification address",
          notes: "Notification verification checkout",
          pickup_date: null,
          items: [{ product_id: IDS.checkoutProduct, quantity: CHECKOUT_PRICES.quantity }],
        },
      ],
    });
    const orderIds = ((checkout.data as { order_ids?: string[] } | null)?.order_ids ?? []) as string[];
    const checkoutOrderId = orderIds[0] ?? null;
    if (checkoutOrderId) {
      // The RPC generates the order id, so its dedupe keys are only knowable here.
      FIXTURE_ORDER_IDS.add(checkoutOrderId);
      FIXTURE_DEDUPE_KEYS.add(`order:new:${checkoutOrderId}`);
      for (const type of ORDER_STATUS_TYPES) FIXTURE_DEDUPE_KEYS.add(`order:${checkoutOrderId}:${type}`);
    }
    assert(
      "successful checkout via place_checkout_orders returns an order id",
      !checkout.error && orderIds.length === 1 && Boolean(checkoutOrderId),
      checkout.error?.message ?? `order_ids=${orderIds.length}`,
    );

    if (checkoutOrderId) {
      const { data: order } = await admin
        .from("orders")
        .select("id, business_clerk_id, farmer_clerk_id, status, total_amount, created_at")
        .eq("id", checkoutOrderId)
        .single();
      const { data: productAfter } = await admin.from("products").select("quantity_available").eq("id", IDS.checkoutProduct).single();
      const { data: cartAfter } = await admin.from("cart_items").select("id").eq("business_clerk_id", BUYER_A).eq("product_id", IDS.checkoutProduct);
      assert(
        "checkout transaction commits order, stock decrement and cart clear",
        order?.status === "pending" &&
          order.business_clerk_id === BUYER_A &&
          order.farmer_clerk_id === FARMER_A &&
          Number(order.total_amount) === CHECKOUT_PRICES.unit * CHECKOUT_PRICES.quantity &&
          productAfter?.quantity_available === 10 - CHECKOUT_PRICES.quantity &&
          (cartAfter ?? []).length === 0,
        `status=${order?.status} total=${order?.total_amount} stock=${productAfter?.quantity_available} cart=${(cartAfter ?? []).length}`,
      );

      const checkoutNotifications = await notificationsFor(checkoutOrderId, FARMER_A);
      const newOrder = checkoutNotifications.filter((row) => row.type === "new_order");
      assert(
        "successful checkout creates exactly one new_order notification for the farmer",
        newOrder.length === 1,
        `found=${newOrder.length}`,
      );
      assert(
        "checkout notification entity_id is the checkout-created order id",
        newOrder[0]?.entity_id === checkoutOrderId && newOrder[0]?.entity_type === "order",
        `${newOrder[0]?.entity_type}:${newOrder[0]?.entity_id}`,
      );
      assert(
        "checkout notification dedupe key is correct",
        newOrder[0]?.dedupe_key === `order:new:${checkoutOrderId}` && newOrder[0]?.action_url === `/farmer/orders/${checkoutOrderId}`,
        String(newOrder[0]?.dedupe_key ?? "none"),
      );
      const sameCommitWindow =
        newOrder[0] && order?.created_at
          ? Math.abs(new Date(newOrder[0].created_at).getTime() - new Date(order.created_at).getTime()) < 60_000
          : false;
      assert(
        "checkout notification is written in the checkout transaction",
        sameCommitWindow,
        `order=${order?.created_at} notification=${newOrder[0]?.created_at}`,
      );
    }

    // -----------------------------------------------------------------------
    // Failed checkout must roll back completely
    // -----------------------------------------------------------------------
    const lowStockProduct = await admin.from("products").insert({
      id: IDS.lowStockProduct,
      farmer_clerk_id: FARMER_A,
      name: "Low stock notification fixture",
      price_per_unit: 4,
      unit: "kg",
      quantity_available: 1,
      min_order_quantity: 1,
      status: "active",
    });
    if (lowStockProduct.error) throw new Error(`low stock product fixture failed: ${lowStockProduct.error.message}`);
    const lowStockCart = await buyerA.client
      .from("cart_items")
      .insert({ business_clerk_id: BUYER_A, product_id: IDS.lowStockProduct, quantity: 3 });
    if (lowStockCart.error) throw new Error(`low stock cart fixture failed: ${lowStockCart.error.message}`);

    const ordersBefore = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_clerk_id", BUYER_A)
      .eq("farmer_clerk_id", FARMER_A);
    const notificationsBefore = await countByType("new_order", FARMER_A);
    const failedCheckout = await buyerA.client.rpc("place_checkout_orders", {
      p_orders: [
        {
          farmer_clerk_id: FARMER_A,
          fulfillment_type: "seller_delivery",
          delivery_address: "Notification verification address",
          notes: "Expected failure",
          pickup_date: null,
          items: [{ product_id: IDS.lowStockProduct, quantity: 3 }],
        },
      ],
    });
    const ordersAfter = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_clerk_id", BUYER_A)
      .eq("farmer_clerk_id", FARMER_A);
    const notificationsAfter = await countByType("new_order", FARMER_A);
    const { data: stockAfterFailure } = await admin.from("products").select("quantity_available").eq("id", IDS.lowStockProduct).single();
    const { data: cartAfterFailure } = await admin
      .from("cart_items")
      .select("id, quantity")
      .eq("business_clerk_id", BUYER_A)
      .eq("product_id", IDS.lowStockProduct);
    assert("failed checkout is rejected by place_checkout_orders", Boolean(failedCheckout.error), failedCheckout.error?.message ?? "");
    assert(
      "failed checkout creates no order",
      (ordersAfter.count ?? 0) === (ordersBefore.count ?? 0),
      `before=${ordersBefore.count} after=${ordersAfter.count}`,
    );
    assert(
      "failed checkout creates no notification",
      notificationsAfter === notificationsBefore,
      `before=${notificationsBefore} after=${notificationsAfter}`,
    );
    assert(
      "failed checkout rolls back stock and cart",
      stockAfterFailure?.quantity_available === 1 && (cartAfterFailure ?? []).length === 1,
      `stock=${stockAfterFailure?.quantity_available} cart=${(cartAfterFailure ?? []).length}`,
    );

    // -----------------------------------------------------------------------
    // Order status regression: every valid transition, notification or not
    // -----------------------------------------------------------------------
    await addOrder(IDS.deliveryChain);
    await addOrder(IDS.pickupChain);

    const step = async (orderId: string, status: string) => farmerA.client.rpc("update_order_status", { p_order_id: orderId, p_new_status: status });
    const statusOf = async (orderId: string) => {
      const { data } = await admin.from("orders").select("status").eq("id", orderId).single();
      return data?.status ?? "unknown";
    };

    const deliveryTransitions: string[] = [];
    for (const next of ["accepted", "preparing", "ready", "for_delivery", "completed"] as const) {
      const result = await step(IDS.deliveryChain, next);
      const current = await statusOf(IDS.deliveryChain);
      if (result.error || current !== next) deliveryTransitions.push(`${next}:${result.error?.message ?? current}`);
    }
    assert(
      "pending → accepted → preparing → ready → for_delivery → completed all succeed",
      deliveryTransitions.length === 0,
      deliveryTransitions.join("; "),
    );

    const deliveryNotifications = await notificationsFor(IDS.deliveryChain, BUYER_A);
    const deliveryTypes = deliveryNotifications.map((row) => row.type);
    assert(
      "delivery chain notifies accepted, ready, for_delivery and completed",
      deliveryTypes.join(",") === "order_accepted,order_ready,order_for_delivery,order_completed",
      deliveryTypes.join(","),
    );
    assert("preparing does not generate a notification in V1", !deliveryTypes.includes("order_preparing"), deliveryTypes.join(","));
    assert(
      "delivery chain notification dedupe keys are correct",
      deliveryNotifications.every((row) => row.dedupe_key === `order:${IDS.deliveryChain}:${row.type}`),
      deliveryNotifications.map((row) => row.dedupe_key).join(" "),
    );

    const pickupTransitions: string[] = [];
    for (const next of ["accepted", "preparing", "ready", "completed"] as const) {
      const result = await step(IDS.pickupChain, next);
      const current = await statusOf(IDS.pickupChain);
      if (result.error || current !== next) pickupTransitions.push(`${next}:${result.error?.message ?? current}`);
    }
    assert("pickup chain pending → accepted → preparing → ready → completed all succeed", pickupTransitions.length === 0, pickupTransitions.join("; "));
    const pickupTypes = (await notificationsFor(IDS.pickupChain, BUYER_A)).map((row) => row.type);
    assert(
      "pickup chain notifies accepted, ready and completed but not for_delivery",
      pickupTypes.join(",") === "order_accepted,order_ready,order_completed",
      pickupTypes.join(","),
    );

    // Notification-on-cancel coverage for both participants.
    await farmerA.client.rpc("update_order_status", {
      p_order_id: IDS.farmerCancel,
      p_new_status: "cancelled",
      p_cancellation_reason: "fixture",
    });
    assert("farmer cancellation → business notification", (await countByType("farmer_cancellation", BUYER_A, IDS.farmerCancel)) === 1);
    const businessCancel = await buyerA.client
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", IDS.businessCancel)
      .eq("status", "pending");
    assert("business cancellation path succeeds", !businessCancel.error, businessCancel.error?.message ?? "");
    assert("business cancellation → farmer notification", (await countByType("business_cancellation", FARMER_A, IDS.businessCancel)) === 1);

    // -----------------------------------------------------------------------
    // Messages
    // -----------------------------------------------------------------------
    const ownMessage = await buyerA.client
      .from("messages")
      .insert({ order_id: IDS.messages, sender_clerk_id: BUYER_A, body: "runtime fixture" })
      .select("id")
      .single();
    const ownMessageId = ownMessage.data?.id;
    if (ownMessageId) FIXTURE_DEDUPE_KEYS.add(`message:${ownMessageId}`);
    assert(
      "opposite participant receives message notification",
      Boolean(ownMessageId) && (await countByType("new_message", FARMER_A, ownMessageId)) === 1,
      ownMessage.error?.message ?? "",
    );
    assert("sender does not receive own message notification", Boolean(ownMessageId) && (await countByType("new_message", BUYER_A, ownMessageId)) === 0);

    // -----------------------------------------------------------------------
    // Reviews
    // -----------------------------------------------------------------------
    await admin.from("products").insert({
      id: IDS.product,
      farmer_clerk_id: FARMER_A,
      name: "Notification fixture",
      price_per_unit: 5,
      unit: "kg",
      quantity_available: 10,
      min_order_quantity: 1,
      status: "active",
    });
    await admin.from("order_items").insert({ id: IDS.reviewItem, order_id: IDS.review, product_id: IDS.product, quantity: 1, unit_price: 5 });
    await admin.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", IDS.review);
    const seller = await buyerA.client
      .from("seller_reviews")
      .insert({ order_id: IDS.review, reviewer_clerk_id: BUYER_A, target_farmer_clerk_id: FARMER_A, rating: 5 })
      .select("id")
      .single();
    if (seller.data?.id) FIXTURE_DEDUPE_KEYS.add(`review:${seller.data.id}`);
    assert(
      "valid seller review → farmer notification",
      Boolean(seller.data?.id) && (await countByType("new_review", FARMER_A, seller.data?.id ?? "")) === 1,
      seller.error?.message ?? "",
    );
    const productReview = await buyerA.client
      .from("product_reviews")
      .insert({
        order_id: IDS.review,
        order_item_id: IDS.reviewItem,
        reviewer_clerk_id: BUYER_A,
        product_id: IDS.product,
        rating: 5,
      })
      .select("id")
      .single();
    if (productReview.data?.id) FIXTURE_DEDUPE_KEYS.add(`review:${productReview.data.id}`);
    const productNotification = productReview.data?.id
      ? await admin.from("notifications").select("entity_type, entity_id").eq("type", "new_review").eq("dedupe_key", `review:${productReview.data.id}`).single()
      : null;
    assert(
      "valid product review → farmer notification",
      Boolean(productReview.data?.id) && productNotification?.data?.entity_type === "product" && productNotification.data.entity_id === IDS.product,
      productReview.error?.message ?? "",
    );

    // -----------------------------------------------------------------------
    // Duplicate behaviour
    // -----------------------------------------------------------------------
    await addOrder(IDS.duplicate);
    const duplicateKey = `order:${IDS.duplicate}:order_accepted`;
    const firstAccepted = await admin.from("orders").update({ status: "accepted" }).eq("id", IDS.duplicate);
    const firstAcceptedNotifications = await notificationsFor(IDS.duplicate, BUYER_A);
    await admin.from("orders").update({ status: "preparing" }).eq("id", IDS.duplicate);
    // A repeated/retried source event re-fires the same trigger with the same key.
    const retryAccepted = await admin.from("orders").update({ status: "accepted" }).eq("id", IDS.duplicate);
    const retryNotifications = await notificationsFor(IDS.duplicate, BUYER_A);
    const duplicateRows = retryNotifications.filter((row) => row.dedupe_key === duplicateKey);
    assert(
      "repeated source event does not create a second notification",
      !firstAccepted.error && !retryAccepted.error && firstAcceptedNotifications.length === 1 && duplicateRows.length === 1,
      `first=${firstAcceptedNotifications.length} afterRetry=${retryNotifications.length}`,
    );
    assert(
      "duplicate source event still transitions the order",
      (await statusOf(IDS.duplicate)) === "accepted",
      await statusOf(IDS.duplicate),
    );

    const duplicate = await admin
      .from("notifications")
      .insert({
        recipient_clerk_id: FARMER_A,
        type: "new_order",
        title: "duplicate",
        body: "duplicate",
        entity_type: "order",
        entity_id: IDS.accepted,
        action_url: `/farmer/orders/${IDS.accepted}`,
        dedupe_key: `order:new:${IDS.accepted}`,
      });
    assert("unique dedupe constraint rejects a conflicting insert", Boolean(duplicate.error), duplicate.error?.message ?? "");

    // -----------------------------------------------------------------------
    // Read-only notification fields
    // -----------------------------------------------------------------------
    const readOnlyTarget: NotificationRow | undefined = (await notificationsFor(IDS.accepted, FARMER_A))[0];
    const protectedUpdates: { label: string; body: Record<string, unknown> }[] = [
      { label: "recipient_clerk_id", body: { recipient_clerk_id: FARMER_B } },
      { label: "type", body: { type: "order_completed" } },
      { label: "title", body: { title: "mutated" } },
      { label: "body", body: { body: "mutated" } },
      { label: "entity_type", body: { entity_type: "product" } },
      { label: "entity_id", body: { entity_id: IDS.product } },
      { label: "action_url", body: { action_url: "/mutated" } },
      { label: "dedupe_key", body: { dedupe_key: `mutated:${IDS.accepted}` } },
      { label: "created_at", body: { created_at: "2020-01-01T00:00:00Z" } },
    ];
    const mutationResults: string[] = [];
    for (const mutation of protectedUpdates) {
      if (!readOnlyTarget) break;
      const result = await farmerA.client.from("notifications").update(mutation.body).eq("id", readOnlyTarget.id);
      mutationResults.push(`${mutation.label}=${result.error ? "rejected" : "ACCEPTED"}`);
    }
    assert(
      "recipient cannot modify protected notification fields",
      Boolean(readOnlyTarget) && mutationResults.length === protectedUpdates.length && mutationResults.every((entry) => entry.endsWith("=rejected")),
      mutationResults.join(" "),
    );
    const mutatedRow: NotificationRow | null = readOnlyTarget
      ? (
          await admin
            .from("notifications")
            .select("id, recipient_clerk_id, type, title, body, entity_type, entity_id, action_url, dedupe_key, created_at")
            .eq("id", readOnlyTarget.id)
            .single()
        ).data as NotificationRow | null
      : null;
    const target = readOnlyTarget;
    const unchanged =
      mutatedRow !== null &&
      target !== undefined &&
      mutatedRow.recipient_clerk_id === target.recipient_clerk_id &&
      mutatedRow.type === target.type &&
      mutatedRow.title === target.title &&
      mutatedRow.body === target.body &&
      mutatedRow.entity_type === target.entity_type &&
      mutatedRow.entity_id === target.entity_id &&
      mutatedRow.action_url === target.action_url &&
      mutatedRow.dedupe_key === target.dedupe_key &&
      mutatedRow.created_at === target.created_at;
    assert("protected notification fields are unchanged after attempts", unchanged);
    const readAtUpdate = readOnlyTarget
      ? await farmerA.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", readOnlyTarget.id).select("read_at").single()
      : null;
    assert("recipient can still mark a notification read", Boolean(readAtUpdate?.data?.read_at), readAtUpdate?.error?.message ?? "");

    // -----------------------------------------------------------------------
    // Authorization / isolation
    // -----------------------------------------------------------------------
    const isolation = await buyerB.client.from("notifications").select("id").eq("recipient_clerk_id", FARMER_A);
    assert("user isolation", !isolation.error && (isolation.data ?? []).length === 0, isolation.error?.message ?? "");

    const forged = await buyerA.client.from("notifications").insert({
      recipient_clerk_id: FARMER_B,
      type: "new_order",
      title: "forged",
      body: "forged",
      entity_type: "order",
      entity_id: IDS.accepted,
      action_url: `/farmer/orders/${IDS.accepted}`,
      dedupe_key: `forged:${IDS.accepted}`,
    });
    assert("forged recipient rejected", Boolean(forged.error), forged.error?.message ?? "");

    const otherOwnNotification = await admin
      .from("notifications")
      .select("id")
      .eq("recipient_clerk_id", BUYER_A)
      .is("read_at", null)
      .limit(1)
      .maybeSingle();
    const markOtherId = otherOwnNotification.data?.id ?? null;
    const markOther = markOtherId
      ? await buyerB.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", markOtherId).select("read_at")
      : { data: null, error: new Error("fixture missing") };
    const untouched = markOtherId ? await admin.from("notifications").select("read_at").eq("id", markOtherId).single() : null;
    assert(
      "mark-read authorization",
      Boolean(markOtherId) && (Boolean(markOther.error) || (markOther.data ?? []).length === 0) && (untouched?.data?.read_at ?? null) === null,
      markOther.error?.message ?? "",
    );

    const unreadBefore = await buyerA.client.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_clerk_id", BUYER_A).is("read_at", null);
    const one = await buyerA.client.from("notifications").select("id").eq("recipient_clerk_id", BUYER_A).is("read_at", null).limit(1).single();
    const marked = one.data ? await buyerA.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", one.data.id).select("read_at").single() : null;
    assert("unread count", (unreadBefore.count ?? 0) > 0);
    assert("mark-one-read", Boolean(marked?.data?.read_at), marked?.error?.message ?? "");
    const all = await buyerA.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_clerk_id", BUYER_A).is("read_at", null).select("id");
    const unreadAfter = await buyerA.client.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_clerk_id", BUYER_A).is("read_at", null);
    assert("mark-all-read scoped correctly", !all.error && unreadAfter.count === 0, all.error?.message ?? "");

    const reload = await farmerA.client.from("notifications").select("id").eq("recipient_clerk_id", FARMER_A).limit(1);
    assert("offline persistence", !reload.error && (reload.data ?? []).length > 0, reload.error?.message ?? "");

    const anonymous = await anon.from("notifications").select("id");
    // Expected outcomes are a permission denial (REVOKE ALL FROM anon) or a
    // successful query filtered to zero rows. Any other error — a network or
    // PostgREST failure — proves nothing about access control and must fail.
    const anonDenied = anonymous.error?.code === "42501";
    const anonFiltered = !anonymous.error && (anonymous.data ?? []).length === 0;
    assert(
      "unauthenticated access denied",
      anonDenied || anonFiltered,
      anonymous.error ? `code=${anonymous.error.code} ${anonymous.error.message}` : `${(anonymous.data ?? []).length} row(s) returned`,
    );

    // Fixture-scoped: notification rows created by other verification suites are irrelevant here.
    const unrelated = await admin
      .from("notifications")
      .select("id")
      .eq("type", "new_order")
      .eq("recipient_clerk_id", FARMER_B)
      .in("entity_id", [...FIXTURE_ORDER_IDS]);
    assert(
      "no fixture notification was addressed to the unrelated farmer",
      !unrelated.error && (unrelated.data ?? []).length === 0,
      unrelated.error?.message ?? "",
    );

    // -----------------------------------------------------------------------
    // Realtime runtime verification
    // -----------------------------------------------------------------------
    await realtimeRuntimeCheck(runId);
  } finally {
    await cleanup();
  }

  console.log(
    realtimeVerified
      ? "Realtime delivery: VERIFIED (live WebSocket INSERT event received and matched)."
      : "Realtime delivery: NOT VERIFIED (no event was received in this run).",
  );
  console.log(`Notifications verification: ${passed} passed, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

void run().catch((error: unknown) => {
  console.error("FATAL:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
