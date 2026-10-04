// =============================================================================
// UMA Market — Phase 2: Database-side Overview Dashboard Aggregation
// Verification Suite
//
// Proves the overview RPCs against an independent brute-force calculation run
// over controlled fixtures, for both dashboard roles, and verifies the
// tenant-isolation / JWT-identity security model.
//
// Two oracles are used on purpose:
//   1. Hand-computed expectations for the fixture set — catches wrong window
//      boundaries (inclusive start, exclusive end) and mis-bucketed days.
//   2. A brute-force implementation of the Phase 1 metric definitions in
//      TypeScript over the raw rows read with the service-role client — the
//      SQL aggregation and the JS aggregation share no code path.
//
// SAFETY RULES:
//   1. Credentials are loaded EXCLUSIVELY from .env.security-test.local.
//   2. ABORTS (exit 2) unless the resolved Supabase project is exactly the
//      dedicated security-test project, and unless the Clerk key is a
//      development-instance key (this suite mints Clerk sessions).
//   3. Every fixture uses a deterministic ID and is removed in finally{}.
//   4. Never prints secrets or tokens.
//   5. Every assertion evaluates a real condition; nothing is hard-coded true.
// =============================================================================

import { createClerkClient } from "@clerk/backend";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import Module from "node:module";
import * as path from "path";
import { assertClerkDevelopmentKey, loadSecurityTestEnv } from "./lib/safety-guard";
import type { Database } from "../src/lib/database.types";
import {
  resolveOverviewRange,
  type OverviewDateRange,
} from "../src/lib/overview-range";

const SCRIPT = "verify-overview-aggregation";

const env = loadSecurityTestEnv(SCRIPT);
assertClerkDevelopmentKey(SCRIPT, env.clerkSecretKey);

const supabaseUrl = env.supabaseUrl;
const anonKey = env.anonKey;
const secretKey = env.secretKey;

if (!env.clerkPublishableKey) {
  console.error(`FATAL: Missing required security-test Clerk publishable key in .env.security-test.local.`);
  process.exit(1);
}

const clerk = createClerkClient({
  secretKey: env.clerkSecretKey,
  publishableKey: env.clerkPublishableKey,
});

const admin = createClient<Database>(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
/** Untyped on purpose: negative tests must pass argument shapes the typed schema rejects. */
const anon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;

function assert(id: string, description: string, condition: boolean, details = "") {
  if (condition) passed++;
  else failed++;
  console.log(`${condition ? "PASS" : "FAIL"} [${id}] ${description}${details ? ` — ${details}` : ""}`);
}

const json = (value: unknown) => JSON.stringify(value);

function assertEq(id: string, description: string, actual: unknown, expected: unknown, details: string) {
  assert(id, description, json(actual) === json(expected), `${details} | actual=${json(actual)} expected=${json(expected)}`);
}

// ── Personas (development-instance Clerk users, roles from public_metadata) ─

const BUYER_A = "user_3JhPbugktYsiMOGIDxF40YwRzx7";
const BUYER_B = "user_3JhUSSDpL2bmzswoMoNM6RzDkyn";
const FARMER_A = "user_3JhPbDuVSiPLuEA6Z8oo86c4Jmr";
const FARMER_B = "user_3JhUSQewYXAYXR80cEFQNwGvsZs";

const PERSONA_ROLES: Record<string, string> = {
  [BUYER_A]: "business",
  [BUYER_B]: "business",
  [FARMER_A]: "farmer",
  [FARMER_B]: "farmer",
};
const PERSONA_IDS = [BUYER_A, BUYER_B, FARMER_A, FARMER_B];

// ── Window: a fixed past window, so no other suite's fixtures can collide ──

const range: OverviewDateRange = resolveOverviewRange({
  range: "custom",
  from: "2019-06-10",
  to: "2019-06-16",
});

const RPC_ARGS = {
  p_prev_start: range.previous.startIso,
  p_start: range.startIso,
  p_end: range.endIso,
};

// A custom 3-week window that overlaps the fixture set, so the brute-force
// oracle can also validate metrics/chart values (not just bucket count).
const multiWeek: OverviewDateRange = resolveOverviewRange({
  range: "custom",
  from: "2019-06-10",
  to: "2019-06-30",
});
const multiWeekArgs = {
  p_prev_start: multiWeek.previous.startIso,
  p_start: multiWeek.startIso,
  p_end: multiWeek.endIso,
};

// ── Fixtures ────────────────────────────────────────────────────────────────

const FIXTURE_UUID_NAMESPACE = "f00000a7-0000-4000-8000";
const fixtureId = (ordinal: number) =>
  `${FIXTURE_UUID_NAMESPACE}-${ordinal.toString(16).padStart(12, "0")}`;

interface FixtureOrder {
  ordinal: number;
  business: string;
  farmer: string;
  status: string;
  total: number;
  createdAt: string;
}

/**
 * Boundary-heavy fixture set for the 2019-06-10..2019-06-16 Manila window
 * (previous window 2019-06-03..2019-06-09):
 *
 *  - ordinal 1  sits exactly on p_start          → counted in current
 *  - ordinal 8  sits exactly on p_end            → excluded entirely
 *  - ordinal 11 sits exactly on p_prev_start     → counted in previous
 *  - ordinal 12 sits 1s before p_prev_start      → excluded entirely
 *  - ordinal 4  is 16:00Z (Manila midnight)     → 2019-06-13, not 2019-06-12
 *  - ordinals 13/14 give farmer A a second buyer → activeBuyers > 1
 */
const FIXTURES: FixtureOrder[] = [
  { ordinal: 1, business: BUYER_A, farmer: FARMER_A, status: "completed", total: 1000, createdAt: "2019-06-09T16:00:00.000Z" },
  { ordinal: 2, business: BUYER_A, farmer: FARMER_A, status: "completed", total: 500, createdAt: "2019-06-11T03:30:00.000Z" },
  { ordinal: 3, business: BUYER_A, farmer: FARMER_A, status: "accepted", total: 250, createdAt: "2019-06-12T15:59:59.000Z" },
  { ordinal: 4, business: BUYER_A, farmer: FARMER_A, status: "pending", total: 50, createdAt: "2019-06-12T16:00:00.000Z" },
  { ordinal: 5, business: BUYER_A, farmer: FARMER_A, status: "cancelled", total: 9999, createdAt: "2019-06-14T12:00:00.000Z" },
  { ordinal: 6, business: BUYER_A, farmer: FARMER_A, status: "completed", total: 400, createdAt: "2019-06-16T15:59:59.000Z" },
  { ordinal: 7, business: BUYER_A, farmer: FARMER_A, status: "ready", total: 75, createdAt: "2019-06-10T01:00:00.000Z" },
  // p_end boundary (exclusive) — must never be counted anywhere
  { ordinal: 8, business: BUYER_A, farmer: FARMER_A, status: "completed", total: 888, createdAt: "2019-06-16T16:00:00.000Z" },
  { ordinal: 9, business: BUYER_A, farmer: FARMER_A, status: "completed", total: 300, createdAt: "2019-06-05T10:00:00.000Z" },
  { ordinal: 10, business: BUYER_A, farmer: FARMER_A, status: "pending", total: 60, createdAt: "2019-06-09T15:59:59.000Z" },
  // p_prev_start boundary (inclusive) — counted in the previous window
  { ordinal: 11, business: BUYER_A, farmer: FARMER_A, status: "completed", total: 200, createdAt: "2019-06-02T16:00:00.000Z" },
  // 1 second before p_prev_start — must never be counted anywhere
  { ordinal: 12, business: BUYER_A, farmer: FARMER_A, status: "completed", total: 12345, createdAt: "2019-06-02T15:59:59.000Z" },
  // second buyer for farmer A (cross pair) + one cancelled cross order
  { ordinal: 13, business: BUYER_B, farmer: FARMER_A, status: "completed", total: 400, createdAt: "2019-06-11T05:00:00.000Z" },
  { ordinal: 14, business: BUYER_B, farmer: FARMER_A, status: "cancelled", total: 999, createdAt: "2019-06-12T05:00:00.000Z" },
  // tenant B (disjoint from tenant A apart from the cross pair above)
  { ordinal: 15, business: BUYER_B, farmer: FARMER_B, status: "completed", total: 70, createdAt: "2019-06-11T02:00:00.000Z" },
  { ordinal: 16, business: BUYER_B, farmer: FARMER_B, status: "accepted", total: 30, createdAt: "2019-06-13T02:00:00.000Z" },
  { ordinal: 17, business: BUYER_B, farmer: FARMER_B, status: "completed", total: 10, createdAt: "2019-06-04T02:00:00.000Z" },
];

const FIXTURE_IDS = FIXTURES.map((f) => fixtureId(f.ordinal));

const PREV_START_MS = new Date(range.previous.startIso).getTime();
const END_MS = new Date(range.endIso).getTime();

const msInWindow = (iso: string) => {
  const t = new Date(iso).getTime();
  return t >= PREV_START_MS && t < END_MS;
};
const FIXTURES_IN_WINDOW = FIXTURES.filter((f) => msInWindow(f.createdAt)).length;

// ── Oracle 1: hand-computed expectations ────────────────────────────────────

const HAND = {
  farmerA: { revenue: 2300, pipeline: 3, orders: 9, activeBuyers: 2, previous: { revenue: 500, pipeline: 1, orders: 3, activeBuyers: 1 } },
  businessA: { revenue: 1900, pipeline: 3, orders: 7, activeBuyers: 1, previous: { revenue: 500, pipeline: 1, orders: 3, activeBuyers: 1 } },
  farmerB: { revenue: 70, pipeline: 1, orders: 2, activeBuyers: 1, previous: { revenue: 10, pipeline: 0, orders: 1, activeBuyers: 1 } },
  businessB: { revenue: 470, pipeline: 1, orders: 4, activeBuyers: 2, previous: { revenue: 10, pipeline: 0, orders: 1, activeBuyers: 1 } },
};

// ── Oracle 2: independent brute force in TypeScript ─────────────────────────

const OPEN_STATUSES = ["pending", "accepted", "preparing", "ready", "for_delivery"];
const IN_PROGRESS_STATUSES = ["accepted", "preparing", "ready", "for_delivery"];

interface WindowRow {
  business_clerk_id: string;
  farmer_clerk_id: string;
  status: string;
  total_amount: number | null;
  created_at: string;
}

interface MetricsShape {
  revenue: number;
  pipeline: number;
  orders: number;
  activeBuyers: number;
  previous: { revenue: number; pipeline: number; orders: number; activeBuyers: number };
}

interface BruteForceResult {
  metrics: MetricsShape;
  chart: Array<{ day: string; label: string; sales: number; orders: number }>;
  status: Array<{ status: string; count: number }>;
  total: number;
}

const manilaDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
const chartLabel = (dayKey: string) =>
  new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function bruteForce(rows: WindowRow[], side: "farmer" | "business", clerkId: string, r: OverviewDateRange): BruteForceResult {
  const prevStartMs = new Date(r.previous.startIso).getTime();
  const startMs = new Date(r.startIso).getTime();
  const endMs = new Date(r.endIso).getTime();
  const inWindow = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= prevStartMs && t < endMs;
  };
  const scoped = rows.filter(
    (r) =>
      inWindow(r.created_at) &&
      (side === "farmer" ? r.farmer_clerk_id === clerkId : r.business_clerk_id === clerkId),
  );
  const current = scoped.filter((r) => new Date(r.created_at).getTime() >= startMs);
  const previous = scoped.filter((r) => new Date(r.created_at).getTime() < startMs);
  const counterparty = (r: WindowRow) => (side === "farmer" ? r.business_clerk_id : r.farmer_clerk_id);

  const summarize = (set: WindowRow[]) => {
    let revenue = 0;
    let pipeline = 0;
    const buyers = new Set<string>();
    for (const r of set) {
      if (r.status === "cancelled") continue;
      if (r.status === "completed") revenue += Number(r.total_amount ?? 0);
      if (OPEN_STATUSES.includes(r.status)) pipeline++;
      buyers.add(counterparty(r));
    }
    return { revenue, pipeline, orders: set.length, activeBuyers: buyers.size };
  };

  const chart = r.dayKeys.map((day) => {
    const forDay = current.filter((r) => manilaDayFormatter.format(new Date(r.created_at)) === day);
    return {
      day,
      label: chartLabel(day),
      sales: forDay
        .filter((r) => r.status === "completed")
        .reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0),
      orders: forDay.length,
    };
  });

  const counts = new Map<string, number>();
  for (const r of current) {
    const key = IN_PROGRESS_STATUSES.includes(r.status) ? "in_progress" : r.status;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const status = [...counts.entries()]
    .map(([statusKey, count]) => ({ status: statusKey, count }))
    .sort((a, b) => a.status.localeCompare(b.status));

  return {
    metrics: { ...summarize(current), previous: summarize(previous) },
    chart,
    status,
    total: status.reduce((sum, s) => sum + s.count, 0),
  };
}

// ── Payload readers (test-local, independent of the app decoder) ────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
const numOf = (value: unknown) => (typeof value === "number" ? value : NaN);

function readRpcMetrics(data: unknown): MetricsShape | null {
  const root = asRecord(data);
  const metrics = asRecord(root?.metrics);
  const previous = asRecord(metrics?.previous);
  if (!root || !metrics || !previous) return null;
  return {
    revenue: numOf(metrics.revenue),
    pipeline: numOf(metrics.pipeline),
    orders: numOf(metrics.orders),
    activeBuyers: numOf(metrics.active_buyers),
    previous: {
      revenue: numOf(previous.revenue),
      pipeline: numOf(previous.pipeline),
      orders: numOf(previous.orders),
      activeBuyers: numOf(previous.active_buyers),
    },
  };
}

function readRpcChart(data: unknown): Array<[string, number, number]> | null {
  const root = asRecord(data);
  if (!root || !Array.isArray(root.chart)) return null;
  return root.chart.map((entry) => {
    const point = asRecord(entry);
    return [String(point?.day ?? ""), numOf(point?.sales), numOf(point?.orders)] as [string, number, number];
  });
}

function readRpcStatus(data: unknown): Array<[string, number]> | null {
  const root = asRecord(data);
  if (!root || !Array.isArray(root.status)) return null;
  return root.status
    .map((entry) => {
      const row = asRecord(entry);
      return [String(row?.status ?? ""), numOf(row?.count)] as [string, number];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));
}

const metricTuple = (m: MetricsShape | null): number[] | null =>
  m
    ? [
        m.revenue, m.pipeline, m.orders, m.activeBuyers,
        m.previous.revenue, m.previous.pipeline, m.previous.orders, m.previous.activeBuyers,
      ]
    : null;

// ── Fixtures lifecycle ──────────────────────────────────────────────────────

const createdProfiles: string[] = [];

async function cleanupFixtures() {
  const dedupeKeys = FIXTURE_IDS.map((id) => `order:new:${id}`);
  for (let i = 0; i < dedupeKeys.length; i += 50) {
    const { error } = await admin.from("notifications").delete().in("dedupe_key", dedupeKeys.slice(i, i + 50));
    if (error) throw new Error(`Notification fixture cleanup failed: ${error.message}`);
  }
  const { data: leftoverNotifications, error: notificationsCheckError } = await admin
    .from("notifications")
    .select("dedupe_key")
    .in("dedupe_key", dedupeKeys);
  if (notificationsCheckError) {
    throw new Error(`Notification cleanup verification failed: ${notificationsCheckError.message}`);
  }
  if ((leftoverNotifications ?? []).length > 0) {
    throw new Error("Cleanup left fixture notifications behind.");
  }

  const { error: ordersError } = await admin.from("orders").delete().in("id", FIXTURE_IDS);
  if (ordersError) throw new Error(`Order fixture cleanup failed: ${ordersError.message}`);
  const { data: leftoverOrders, error: ordersCheckError } = await admin
    .from("orders")
    .select("id")
    .in("id", FIXTURE_IDS);
  if (ordersCheckError) throw new Error(`Order cleanup verification failed: ${ordersCheckError.message}`);
  if ((leftoverOrders ?? []).length > 0) throw new Error("Cleanup left fixture orders behind.");

  if (createdProfiles.length > 0) {
    const { error } = await admin.from("profiles").delete().in("clerk_id", createdProfiles);
    if (error) throw new Error(`Profile fixture cleanup failed: ${error.message}`);
    createdProfiles.length = 0;
  }
}

async function provisionFixtures() {
  await cleanupFixtures();

  const { data: profiles, error: profileScanError } = await admin
    .from("profiles")
    .select("clerk_id")
    .in("clerk_id", PERSONA_IDS);
  if (profileScanError) throw new Error(`Profile scan failed: ${profileScanError.message}`);

  const existing = new Set((profiles ?? []).map((row) => row.clerk_id));
  const missing = PERSONA_IDS.filter((id) => !existing.has(id));
  if (missing.length > 0) {
    const { error } = await admin.from("profiles").insert(
      missing.map((clerkId) => ({
        clerk_id: clerkId,
        role: PERSONA_ROLES[clerkId],
        full_name: `Overview Fixture ${PERSONA_ROLES[clerkId]}`,
        business_name: "Overview Fixture Co",
        city: "Butuan City",
        status: "active",
      })),
    );
    if (error) throw new Error(`Profile fixture insert failed: ${error.message}`);
    createdProfiles.push(...missing);
  }

  const { error: ordersError } = await admin.from("orders").insert(
    FIXTURES.map((f) => ({
      id: fixtureId(f.ordinal),
      business_clerk_id: f.business,
      farmer_clerk_id: f.farmer,
      status: f.status,
      fulfillment_type: "pickup",
      total_amount: f.total,
      created_at: f.createdAt,
    })),
  );
  if (ordersError) throw new Error(`Order fixture insert failed: ${ordersError.message}`);
}

// ── Authenticated clients (Clerk development sessions) ──────────────────────

const sessions: string[] = [];

async function authProvider(userId: string) {
  const session = await clerk.sessions.createSession({ userId });
  sessions.push(session.id);
  const token = await clerk.sessions.getToken(session.id);
  return async () => token.jwt;
}

// ── App-module wiring: bind @/lib/supabase/server to a tenant session ──────

let activeClient: SupabaseClient<Database> | null = null;

const moduleLoader = Module as typeof Module & {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = moduleLoader._load;
moduleLoader._load = function (request, parent, isMain) {
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        if (!activeClient) throw new Error("No authenticated test client is bound.");
        return activeClient;
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

async function run() {
  try {
    await provisionFixtures();

    // ── Preconditions ───────────────────────────────────────────────────────
    const personaValues = `("${PERSONA_IDS.join('","')}")`;
    const { data: windowRows, error: windowError } = await admin
      .from("orders")
      .select("business_clerk_id, farmer_clerk_id, status, total_amount, created_at")
      .gte("created_at", range.previous.startIso)
      .lt("created_at", range.endIso)
      .or(`business_clerk_id.in.${personaValues},farmer_clerk_id.in.${personaValues}`);
    if (windowError) throw new Error(`Window row fetch failed: ${windowError.message}`);

    assert(
      "PRE-01",
      "Window holds exactly the in-range fixture rows (no stray rows for these personas)",
      (windowRows ?? []).length === FIXTURES_IN_WINDOW,
      `rows=${(windowRows ?? []).length}, fixtures-in-range=${FIXTURES_IN_WINDOW}`,
    );

    const rows = (windowRows ?? []) as WindowRow[];
    const expected = {
      farmerA: bruteForce(rows, "farmer", FARMER_A, range),
      businessA: bruteForce(rows, "business", BUYER_A, range),
      farmerB: bruteForce(rows, "farmer", FARMER_B, range),
      businessB: bruteForce(rows, "business", BUYER_B, range),
    };

    assertEq("OV-02", "Brute force reproduces the hand-computed farmer A metrics", metricTuple(expected.farmerA.metrics), [
      HAND.farmerA.revenue, HAND.farmerA.pipeline, HAND.farmerA.orders, HAND.farmerA.activeBuyers,
      HAND.farmerA.previous.revenue, HAND.farmerA.previous.pipeline, HAND.farmerA.previous.orders, HAND.farmerA.previous.activeBuyers,
    ], "window boundaries + distinct buyers");
    assertEq("OV-03", "Brute force reproduces the hand-computed business A metrics", metricTuple(expected.businessA.metrics), [
      HAND.businessA.revenue, HAND.businessA.pipeline, HAND.businessA.orders, HAND.businessA.activeBuyers,
      HAND.businessA.previous.revenue, HAND.businessA.previous.pipeline, HAND.businessA.previous.orders, HAND.businessA.previous.activeBuyers,
    ], "excludes p_end and pre-prev_start rows");
    assertEq("OV-04", "Brute force reproduces the hand-computed farmer B metrics", metricTuple(expected.farmerB.metrics), [
      HAND.farmerB.revenue, HAND.farmerB.pipeline, HAND.farmerB.orders, HAND.farmerB.activeBuyers,
      HAND.farmerB.previous.revenue, HAND.farmerB.previous.pipeline, HAND.farmerB.previous.orders, HAND.farmerB.previous.activeBuyers,
    ], "tenant B disjoint");
    assertEq("OV-05", "Brute force reproduces the hand-computed business B metrics", metricTuple(expected.businessB.metrics), [
      HAND.businessB.revenue, HAND.businessB.pipeline, HAND.businessB.orders, HAND.businessB.activeBuyers,
      HAND.businessB.previous.revenue, HAND.businessB.previous.pipeline, HAND.businessB.previous.orders, HAND.businessB.previous.activeBuyers,
    ], "cross-pair orders counted for business B");

    // ── Sessions ────────────────────────────────────────────────────────────
    const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } } as const;
    const buyerAToken = await authProvider(BUYER_A);
    const farmerAToken = await authProvider(FARMER_A);
    const buyerBToken = await authProvider(BUYER_B);
    const farmerBToken = await authProvider(FARMER_B);

    const businessA = createClient<Database>(supabaseUrl, anonKey, { accessToken: buyerAToken, ...clientOptions });
    const farmerA = createClient<Database>(supabaseUrl, anonKey, { accessToken: farmerAToken, ...clientOptions });
    const businessB = createClient<Database>(supabaseUrl, anonKey, { accessToken: buyerBToken, ...clientOptions });
    const farmerB = createClient<Database>(supabaseUrl, anonKey, { accessToken: farmerBToken, ...clientOptions });
    /** Untyped twin of the farmer session, used to pass a forged identity argument. */
    const farmerARaw = createClient(supabaseUrl, anonKey, { accessToken: farmerAToken, ...clientOptions });

    // ── Direct RPC vs brute force ───────────────────────────────────────────
    const rpcCases = [
      { id: "OV-06", name: "farmer A", client: farmerA, fn: "get_farmer_overview_metrics" as const, want: expected.farmerA },
      { id: "OV-07", name: "business A", client: businessA, fn: "get_business_overview_metrics" as const, want: expected.businessA },
      { id: "OV-08", name: "farmer B", client: farmerB, fn: "get_farmer_overview_metrics" as const, want: expected.farmerB },
      { id: "OV-09", name: "business B", client: businessB, fn: "get_business_overview_metrics" as const, want: expected.businessB },
    ];

    for (const c of rpcCases) {
      const { data, error } = await c.client.rpc(c.fn, RPC_ARGS);
      if (error) {
        assert(c.id, `RPC results for ${c.name} match the brute force`, false, `RPC error: ${error.message}`);
        continue;
      }

      const root = asRecord(data);
      assertEq(
        `${c.id}a`,
        `RPC metrics for ${c.name} match the brute force`,
        metricTuple(readRpcMetrics(data)),
        metricTuple(c.want.metrics),
        "revenue/pipeline/orders/activeBuyers + previous window",
      );
      assertEq(
        `${c.id}b`,
        `RPC chart buckets for ${c.name} match the brute force`,
        readRpcChart(data),
        c.want.chart.map((point) => [point.day, point.sales, point.orders]),
        "one Manila-day bucket each",
      );
      assertEq(
        `${c.id}c`,
        `RPC status counts for ${c.name} match the brute force`,
        readRpcStatus(data),
        c.want.status.map((row) => [row.status, row.count]),
        "in-progress grouped",
      );
      assert(
        `${c.id}d`,
        `RPC payload for ${c.name} is a compact aggregate (metrics/chart/status only, no order rows)`,
        json(Object.keys(root ?? {}).sort()) === json(["chart", "metrics", "status"]),
        `keys=${json(Object.keys(root ?? {}).sort())}`,
      );
    }

    // ── Range coverage: the chart bucket count is dynamic, never hard-coded ──
    const migrationCode = readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261005000001_overview_dashboard_aggregation.sql"),
      "utf8",
    );
    const decoderCode = readFileSync(
      path.join(process.cwd(), "src/lib/supabase/queries/overview.ts"),
      "utf8",
    );

    assert(
      "RNG-01",
      "RPC chart series bounds come from the window parameters (no hard-coded bucket count)",
      migrationCode.includes("(p_start AT TIME ZONE 'Asia/Manila')::date") &&
        migrationCode.includes("((p_end   AT TIME ZONE 'Asia/Manila')::date - 1)") &&
        migrationCode.includes("interval '1 day'") &&
        !/interval '7 day'/.test(migrationCode),
      "generate_series spans p_start..p_end in 1-day steps",
    );

    function extractFunctionSource(code: string, name: string): string {
      const start = code.search(new RegExp(`function ${name}\\s*\\(`));
      if (start === -1) return "";
      const rest = code.slice(start);
      const nextFn = rest.slice(1).search(/\nfunction |\nexport /);
      return nextFn === -1 ? rest : rest.slice(0, nextFn + 1);
    }

    const buildChartSrc = extractFunctionSource(decoderCode, "buildChart");
    assert(
      "RNG-06",
      "Decoder maps RPC chart buckets 1:1 (no client-side truncation or padding)",
      buildChartSrc.length > 0 &&
        buildChartSrc.includes("return points.map((point) => ({") &&
        !buildChartSrc.includes(".slice("),
      "buildChart is a pure map over the RPC payload",
    );

    // Independent expectation for the mtd bucket count: the Manila day-of-month,
    // computed here without going through resolveOverviewRange.
    const manilaToday = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const mtdExpectedDays = manilaToday.getDate();

    const rangeCases: Array<{
      id: string;
      label: string;
      r: OverviewDateRange;
      expectedDays: number;
      expectMetrics: boolean;
    }> = [
      { id: "RNG-02", label: "7d", r: resolveOverviewRange({ range: "7d" }), expectedDays: 7, expectMetrics: false },
      { id: "RNG-03", label: "30d", r: resolveOverviewRange({ range: "30d" }), expectedDays: 30, expectMetrics: false },
      { id: "RNG-04", label: "mtd", r: resolveOverviewRange({ range: "mtd" }), expectedDays: mtdExpectedDays, expectMetrics: false },
      { id: "RNG-05", label: "custom 3-week", r: multiWeek, expectedDays: 21, expectMetrics: true },
    ];

    for (const c of rangeCases) {
      const { data, error } = await farmerA.rpc("get_farmer_overview_metrics", {
        p_prev_start: c.r.previous.startIso,
        p_start: c.r.startIso,
        p_end: c.r.endIso,
      });
      if (error) {
        assert(c.id, `RPC chart for the ${c.label} range returns ${c.expectedDays} buckets`, false, `RPC error: ${error.message}`);
        continue;
      }
      const chart = readRpcChart(data);
      assert(
        c.id,
        `RPC chart for the ${c.label} range returns exactly ${c.expectedDays} buckets`,
        chart !== null && chart.length === c.expectedDays,
        `buckets=${chart?.length ?? "n/a"} expected=${c.expectedDays}`,
      );
      assert(
        `${c.id}b`,
        `RPC chart for the ${c.label} range spans the resolved Manila day keys`,
        chart !== null &&
          chart[0]?.[0] === c.r.dayKeys[0] &&
          chart[chart.length - 1]?.[0] === c.r.dayKeys[c.r.dayKeys.length - 1],
        `first=${chart?.[0]?.[0] ?? "n/a"} last=${chart?.[chart.length - 1]?.[0] ?? "n/a"}`,
      );
      if (!c.expectMetrics) {
        const metrics = readRpcMetrics(data);
        assert(
          `${c.id}c`,
          `RPC metrics for the ${c.label} range are zero-filled (no fixture orders in window)`,
          metrics !== null && metrics.orders === 0 && metrics.revenue === 0 && metrics.pipeline === 0,
          `orders=${metrics?.orders ?? "n/a"} revenue=${metrics?.revenue ?? "n/a"}`,
        );
      }
    }

    // Full brute-force comparison for the multi-week custom range (fixtures fall inside it).
    {
      const { data: multiWeekRows, error: multiWeekRowsError } = await admin
        .from("orders")
        .select("business_clerk_id, farmer_clerk_id, status, total_amount, created_at")
        .gte("created_at", multiWeek.previous.startIso)
        .lt("created_at", multiWeek.endIso)
        .or(`business_clerk_id.in.${personaValues},farmer_clerk_id.in.${personaValues}`);
      if (multiWeekRowsError) throw new Error(`Multi-week row fetch failed: ${multiWeekRowsError.message}`);

      assert(
        "RNG-05a",
        "Multi-week window holds all 17 fixture rows (oracle sees the full set)",
        (multiWeekRows ?? []).length === FIXTURES.length,
        `rows=${(multiWeekRows ?? []).length} fixtures=${FIXTURES.length}`,
      );

      const want = bruteForce((multiWeekRows ?? []) as WindowRow[], "farmer", FARMER_A, multiWeek);
      const { data, error } = await farmerA.rpc("get_farmer_overview_metrics", multiWeekArgs);
      if (error) {
        assert("RNG-05d", "RPC metrics for the custom 3-week range match the brute force", false, `RPC error: ${error.message}`);
      } else {
        assertEq("RNG-05d", "RPC metrics for the custom 3-week range match the brute force", metricTuple(readRpcMetrics(data)), metricTuple(want.metrics), "window + previous window");
        assertEq("RNG-05e", "RPC chart for the custom 3-week range matches the brute force", readRpcChart(data), want.chart.map((p) => [p.day, p.sales, p.orders]), "21 Manila-day buckets");
      }
    }

    // ── Application query layer end-to-end (decoder, labels, sort) ─────────
    const { getFarmerOverview, getBusinessOverview } = await import(
      "../src/lib/supabase/queries/overview"
    );

    activeClient = farmerA;
    const farmerOverview = await getFarmerOverview(range);
    activeClient = businessA;
    const businessOverview = await getBusinessOverview(range);
    activeClient = null;

    assertEq(
      "OV-10",
      "getFarmerOverview (app layer) matches the brute force",
      [
        metricTuple(farmerOverview.metrics),
        farmerOverview.chart.map((p) => [p.date, p.sales, p.orders]),
        farmerOverview.status.breakdown.map((b) => [b.status, b.count]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        farmerOverview.status.total,
      ],
      [
        metricTuple(expected.farmerA.metrics),
        expected.farmerA.chart.map((point) => [point.label, point.sales, point.orders]),
        expected.farmerA.status.map((row) => [row.status, row.count]),
        expected.farmerA.total,
      ],
      "metrics + labelled chart + status breakdown + total",
    );

    assertEq(
      "OV-11",
      "Farmer status breakdown keeps the Phase 1 display order",
      farmerOverview.status.breakdown.map((b) => b.status),
      ["completed", "pending", "in_progress", "cancelled"],
      "UI ordering preserved",
    );

    const { count: activeProducts, error: productsCountError } = await admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    assert(
      "OV-12",
      "getBusinessOverview (app layer) matches the brute force and the active-products snapshot",
      !productsCountError &&
        json([
          metricTuple(businessOverview.metrics),
          businessOverview.chart.map((p) => [p.date, p.sales, p.orders]),
          businessOverview.status.breakdown.map((b) => [b.status, b.count]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
          businessOverview.metrics.productsListed,
        ]) ===
          json([
            metricTuple(expected.businessA.metrics),
            expected.businessA.chart.map((point) => [point.label, point.sales, point.orders]),
            expected.businessA.status.map((row) => [row.status, row.count]),
            activeProducts ?? -1,
          ]),
      `productsListed=${businessOverview.metrics.productsListed} adminActiveCount=${activeProducts ?? "n/a"}`,
    );

    // ── Tenant isolation ────────────────────────────────────────────────────
    assert(
      "ISO-01",
      "Business B metrics exclude business A's orders entirely",
      json(metricTuple(expected.businessB.metrics)) !== json(metricTuple(expected.businessA.metrics)) &&
        expected.businessB.metrics.revenue === HAND.businessB.revenue,
      `businessB.revenue=${expected.businessB.metrics.revenue} (A would be ${expected.businessA.metrics.revenue})`,
    );
    assert(
      "ISO-02",
      "Farmer B metrics exclude farmer A's orders entirely",
      json(metricTuple(expected.farmerB.metrics)) !== json(metricTuple(expected.farmerA.metrics)) &&
        expected.farmerB.metrics.orders === HAND.farmerB.orders,
      `farmerB.orders=${expected.farmerB.metrics.orders} (A would be ${expected.farmerA.metrics.orders})`,
    );

    // ── Security: identity comes from the JWT, never from an argument ──────
    const farmerRpcAsBusiness = await businessA.rpc("get_farmer_overview_metrics", RPC_ARGS);
    assert(
      "SEC-01",
      "Business session cannot invoke the farmer overview RPC (role claim mismatch)",
      farmerRpcAsBusiness.error?.code === "42501",
      `error=${farmerRpcAsBusiness.error ? `${farmerRpcAsBusiness.error.code}: ${farmerRpcAsBusiness.error.message}` : "none"}`,
    );

    const businessRpcAsFarmer = await farmerA.rpc("get_business_overview_metrics", RPC_ARGS);
    assert(
      "SEC-02",
      "Farmer session cannot invoke the business overview RPC (role claim mismatch)",
      businessRpcAsFarmer.error?.code === "42501",
      `error=${businessRpcAsFarmer.error ? `${businessRpcAsFarmer.error.code}: ${businessRpcAsFarmer.error.message}` : "none"}`,
    );

    const anonFarmerRpc = await anon.rpc("get_farmer_overview_metrics", RPC_ARGS);
    const anonBusinessRpc = await anon.rpc("get_business_overview_metrics", RPC_ARGS);
    assert(
      "SEC-03",
      "Anonymous clients cannot execute either overview RPC (no EXECUTE grant)",
      Boolean(anonFarmerRpc.error) && Boolean(anonBusinessRpc.error) && anonFarmerRpc.data === null && anonBusinessRpc.data === null,
      `farmer=${anonFarmerRpc.error?.message ?? "no error"} | business=${anonBusinessRpc.error?.message ?? "no error"}`,
    );

    const serviceFarmerRpc = await admin.rpc("get_farmer_overview_metrics", RPC_ARGS);
    assert(
      "SEC-04",
      "Service-role client cannot execute the overview RPC (no sub claim, no grant)",
      Boolean(serviceFarmerRpc.error) && serviceFarmerRpc.data === null,
      `error=${serviceFarmerRpc.error?.message ?? "no error"}`,
    );

    const forgedIdentityArg = await farmerARaw.rpc("get_farmer_overview_metrics", {
      ...RPC_ARGS,
      p_farmer_clerk_id: BUYER_A,
    });
    assert(
      "SEC-05",
      "RPCs expose no identity parameter — a client-supplied Clerk ID is rejected outright",
      forgedIdentityArg.error?.code === "PGRST202",
      `error=${forgedIdentityArg.error ? `${forgedIdentityArg.error.code}: ${forgedIdentityArg.error.message}` : "none"}`,
    );
  } finally {
    for (const sessionId of sessions) {
      try {
        await clerk.sessions.revokeSession(sessionId);
      } catch {
        // Session revocation must never mask a verification failure.
      }
    }
    sessions.length = 0;
    activeClient = null;
    await cleanupFixtures();
  }

  console.log("==============================================================================");
  console.log(`Verification Complete: ${passed}/${passed + failed} passed (${failed} failed)`);
  console.log("==============================================================================");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Verification suite failed with unexpected error:", err);
  process.exit(1);
});
