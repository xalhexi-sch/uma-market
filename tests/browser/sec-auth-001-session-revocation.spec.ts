// =============================================================================
// UMA Market — REG-SEC-AUTH-001 regression suite (Session Revocation)
//
// Finding under regression: SEC-AUTH-001 (docs/security/REMEDIATION-RESULTS.md §2).
// A still-valid stateless Clerk JWT kept granting protected access until the token
// TTL expired.
//
// The suite reproduces the three documented regression targets against the
// CURRENT remediation design — it does not redesign that security model:
//
//   REG-SEC-AUTH-001a  After the Clerk session is revoked and profiles.status is
//                     set to 'revoked', the next protected navigation is denied
//                     immediately. The denial is additionally proven to be
//                     status-driven rather than JWT-TTL-driven by repeating it
//                     with a brand-new, full-lifetime Clerk session token.
//
//   REG-SEC-AUTH-001b  An active profile keeps normal dashboard access across
//                     repeated navigations, with no revocation redirect.
//
//   REG-SEC-AUTH-001c  A revoked profile cannot execute the protected checkout
//                     mutation: against a V4 business-owned cart (an active,
//                     BUY-capable business the buyer is a member of), the database
//                     refuses place_v4_checkout_orders on the caller's profile
//                     status, no order is committed and the cart is untouched.
//
//   REG-SEC-AUTH-001d  The propagation path itself: a real Clerk session
//                     revocation followed by a properly svix-signed
//                     session.revoked delivery to POST /api/webhooks/clerk
//                     results in profiles.status = 'revoked'. An unsigned
//                     delivery is refused first and must leave the profile
//                     untouched, so the state change can only come from the
//                     verified webhook. The final leg checks that the
//                     webhook-revoked profile is denied the protected route.
//
//   REG-SEC-AUTH-001e  The V4 buyer routes (/orders, /cart, /checkout) apply the
//                     same gate: an active buyer stays on the requested route,
//                     a revoked buyer gets a real 307 to /sign-in?revoked=true
//                     (never /onboarding), and that target terminates without a
//                     redirect loop.
//
// Every denial is asserted as a real HTTP 307 with a Location header. The gate
// lives in each segment's layout.tsx, outside the segment's loading.tsx Suspense
// boundary; a redirect() issued after streaming starts could only produce a 200
// with an in-page meta refresh, which these probes deliberately reject.
//
// The fallback documented in REMEDIATION-RESULTS.md §7.1 (Clerk webhook delivery
// delay, bounded by the ~60s JWT lifetime) is asserted structurally by the
// full-lifetime-token leg of REG-SEC-AUTH-001a: denial cannot be explained by the
// old token expiring, because the fresh token is inside its entire TTL window.
// =============================================================================

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROD_APP_HOST,
  PROD_SUPABASE_HOST,
  REVOCATION_PRODUCT,
  TEST_SUPABASE_URL,
  cleanupProduct,
  clearBuyerOrders,
  countBuyerOrders,
  authenticatedContext,
  createSessionToken,
  deliverClerkWebhook,
  fixtureUuid,
  manilaTomorrow,
  provisionProduct,
  readClerkSession,
  readProfileStatus,
  resetCart,
  resolvePersona,
  revokeSession,
  runCleanup,
  serviceClient,
  setProfileStatus,
  upsertTestProfile,
  type Persona,
} from "./harness";

// Canonical V4 seller orders workspace. The legacy V2 /farmer/orders route is now
// only a next.config.ts redirect to this page, so probing it would observe the
// static 307 to /dashboard/orders instead of the server-side revocation gate.
const FARMER_PROTECTED_ROUTE = "/dashboard/orders";
const FARMER_HEADING = "Wholesale Order Operations";
const REVOCATION_DENIAL_BUDGET_MS = 5_000;

/** The exact server-side revocation target; a real redirect carries it as Location. */
const REVOKED_SIGN_IN_LOCATION = /^\/sign-in\?revoked=true$/;

/** V4 buyer routes guarded by the same account-status layout gate. */
const BUYER_PROTECTED_ROUTES = ["/orders", "/cart", "/checkout"] as const;

/** Deterministic V4 buyer business, created only if the buyer has no usable one. */
const SEC_AUTH_BUSINESS_ID = fixtureUuid("secauth", 2);
const SEC_AUTH_MEMBER_ID = fixtureUuid("secauth", 3);

let admin: SupabaseClient;
let buyer: Persona;
let farmer: Persona;
let originalFarmerStatus: string | null = null;
let originalBuyerStatus: string | null = null;
let buyerBusinessId: string;
let createdBuyerBusiness = false;

function trackProductionRequests(page: Page): string[] {
  const offenders: string[] = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).host;
    if (host.includes(PROD_SUPABASE_HOST) || host.includes(PROD_APP_HOST)) {
      offenders.push(`${request.method()} ${request.url()}`);
    }
  });
  return offenders;
}

async function signInContext(browser: Browser, persona: Persona): Promise<{ context: BrowserContext; sessionId: string }> {
  return authenticatedContext(browser, persona);
}

interface SsrProbe {
  status: number;
  location: string | null;
}

/** Reads the `exp` claim (epoch milliseconds) from a JWT without verifying it. */
function decodeJwtExp(jwt: string): number {
  const payload = jwt.split(".")[1];
  if (!payload) throw new Error("Malformed JWT: no payload segment");
  const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  const claims = JSON.parse(json) as { exp?: number };
  if (typeof claims.exp !== "number") throw new Error("JWT has no numeric exp claim");
  return claims.exp * 1000;
}

/**
 * Fetches the protected route WITHOUT following redirects and returns the raw
 * SSR response.
 *
 * Asserting on the 3xx + `Location` header is the reliable way to observe the
 * server-side authorization gate: Clerk's client-side `<SignIn>` component will
 * immediately bounce an already-signed-in visitor away from `/sign-in`, so the
 * final browser URL is not a stable signal.
 */
async function probeProtectedRoute(
  context: BrowserContext,
  route: string = FARMER_PROTECTED_ROUTE,
): Promise<SsrProbe> {
  const response = await context.request.get(route, { maxRedirects: 0 });
  return { status: response.status(), location: response.headers()["location"] ?? null };
}

/**
 * Asserts the real server-side revocation redirect: HTTP 307 plus a Location of
 * exactly /sign-in?revoked=true. A 200 carrying an in-page meta refresh (what a
 * redirect() after streaming has begun produces) fails here on purpose.
 */
function expectRevocationRedirect(probe: SsrProbe, label: string): void {
  expect(probe.status, `${label}: a revoked profile must get a real 307, not a streamed page`).toBe(307);
  expect(probe.location ?? "", `${label}: the 307 must target the revocation sign-in route`).toMatch(
    REVOKED_SIGN_IN_LOCATION,
  );
}

/**
 * Resolves an active, BUY-capable V4 business the buyer is a member of. When the
 * seeded buyer has none, a deterministic fixture business + OWNER membership is
 * created and removed again in afterAll. Existing seed rows are never mutated.
 */
async function ensureBuyerBusiness(): Promise<string> {
  const { data, error } = await admin
    .from("business_members")
    .select("business_id, created_at, businesses(id, status, can_buy)")
    .eq("user_id", buyer.clerkUserId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`buyer membership lookup failed: ${error.message}`);

  const usable = (data ?? []).find((row) => {
    const biz = Array.isArray(row.businesses) ? row.businesses[0] : row.businesses;
    return biz?.status === "active" && biz?.can_buy === true;
  });
  if (usable) return usable.business_id as string;

  const { error: bizErr } = await admin.from("businesses").upsert(
    { id: SEC_AUTH_BUSINESS_ID, name: "SEC-AUTH-001 Buyer Co", can_buy: true, can_sell: false, status: "active" },
    { onConflict: "id" },
  );
  if (bizErr) throw new Error(`SEC-AUTH-001 business fixture failed: ${bizErr.message}`);
  const { error: memberErr } = await admin.from("business_members").upsert(
    { id: SEC_AUTH_MEMBER_ID, business_id: SEC_AUTH_BUSINESS_ID, user_id: buyer.clerkUserId, role: "OWNER" },
    { onConflict: "id" },
  );
  if (memberErr) throw new Error(`SEC-AUTH-001 membership fixture failed: ${memberErr.message}`);
  createdBuyerBusiness = true;
  return SEC_AUTH_BUSINESS_ID;
}

async function countBusinessOrders(businessId: string): Promise<number> {
  const { count, error } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (error) throw new Error(`countBusinessOrders failed: ${error.message}`);
  return count ?? 0;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = serviceClient();
  [buyer, farmer] = await Promise.all([resolvePersona("business"), resolvePersona("farmer")]);

  // Snapshot the seeded personas' status so the suite restores them exactly.
  originalFarmerStatus = await readProfileStatus(admin, farmer.clerkUserId);
  originalBuyerStatus = await readProfileStatus(admin, buyer.clerkUserId);

  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "SEC-AUTH-001 Farmer");
  await upsertTestProfile(admin, buyer.clerkUserId, "business", "SEC-AUTH-001 Buyer");
  buyerBusinessId = await ensureBuyerBusiness();

  await provisionProduct(admin, {
    id: REVOCATION_PRODUCT,
    farmerClerkId: farmer.clerkUserId,
    name: "SEC-AUTH-001 Pechay",
    pricePerUnit: 120,
    quantity: 40,
    minOrderQuantity: 1,
  });
});

test.afterAll(async () => {
  if (!admin || !buyer || !farmer) {
    const reason =
      "beforeAll did not complete — profile statuses, the buyer order/cart fixtures and the " +
      "SEC-AUTH-001 product may still be present in the shared security-test database.";
    console.error(`[cleanup] FAILED — ${reason}`);
    throw new Error(reason);
  }

  await runCleanup([
    {
      label: `restore farmer profile status (was '${originalFarmerStatus ?? "active"}')`,
      run: () => setProfileStatus(admin, farmer.clerkUserId, (originalFarmerStatus ?? "active") as "active"),
    },
    {
      label: `restore buyer profile status (was '${originalBuyerStatus ?? "active"}')`,
      run: () => setProfileStatus(admin, buyer.clerkUserId, (originalBuyerStatus ?? "active") as "active"),
    },
    { label: "clear buyer orders", run: () => clearBuyerOrders(admin, buyer.clerkUserId) },
    { label: "reset buyer cart", run: () => resetCart(admin, buyer.clerkUserId) },
    { label: "remove SEC-AUTH-001 product fixture", run: () => cleanupProduct(admin, REVOCATION_PRODUCT) },
    ...(createdBuyerBusiness
      ? [
          {
            label: "remove SEC-AUTH-001 business membership fixture",
            run: async () => {
              const { error } = await admin.from("business_members").delete().eq("id", SEC_AUTH_MEMBER_ID);
              if (error) throw new Error(error.message);
            },
          },
          {
            label: "remove SEC-AUTH-001 business fixture",
            run: async () => {
              const { error } = await admin.from("businesses").delete().eq("id", SEC_AUTH_BUSINESS_ID);
              if (error) throw new Error(error.message);
            },
          },
        ]
      : []),
  ]);
});

test("REG-SEC-AUTH-001b: an active profile keeps normal protected-route access across repeated navigations", async ({
  browser,
}) => {
  await setProfileStatus(admin, farmer.clerkUserId, "active");

  const { context } = await signInContext(browser, farmer);
  const page = await context.newPage();
  const offenders = trackProductionRequests(page);

  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(FARMER_PROTECTED_ROUTE, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: FARMER_HEADING }),
      `protected route must render for an active profile (attempt ${attempt})`,
    ).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).pathname, `no revocation redirect (attempt ${attempt})`).not.toBe(
      "/sign-in",
    );
    expect(new URL(page.url()).searchParams.get("revoked")).toBeNull();
  }

  expect(offenders, "no production host may ever be contacted").toEqual([]);
  await context.close();
});

test("REG-SEC-AUTH-001a: revocation denies the next protected navigation immediately, and the denial is not bounded by JWT TTL", async ({
  browser,
}) => {
  await setProfileStatus(admin, farmer.clerkUserId, "active");

  const { context, sessionId } = await signInContext(browser, farmer);
  const page = await context.newPage();
  const offenders = trackProductionRequests(page);

  // --- Leg 1 baseline: a valid session with an active profile is allowed. ---
  await page.goto(FARMER_PROTECTED_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: FARMER_HEADING })).toBeVisible({ timeout: 30_000 });
  const allowedProbe = await probeProtectedRoute(context);
  expect(allowedProbe.status, "an active profile must not be redirected").toBeLessThan(400);
  expect(allowedProbe.status, "an active profile must receive the protected route").toBe(200);

  // --- Leg 2: the documented remediation. profiles.status is what the Clerk
  // webhook sets on session.revoked / user.deleted. The Clerk session itself is
  // still VALID here, so any denial can only come from the local status gate. ---
  await setProfileStatus(admin, farmer.clerkUserId, "revoked");

  const startedAt = Date.now();
  const deniedProbe = await probeProtectedRoute(context);
  const denialMs = Date.now() - startedAt;

  expectRevocationRedirect(deniedProbe, FARMER_PROTECTED_ROUTE);
  expect(
    denialMs,
    `denial must be immediate, not deferred to the JWT TTL (took ${denialMs}ms)`,
  ).toBeLessThanOrEqual(REVOCATION_DENIAL_BUDGET_MS);

  await page.goto(FARMER_PROTECTED_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: FARMER_HEADING }),
    "protected content must not render for a revoked profile",
  ).toHaveCount(0);

  // --- Leg 3: full-lifetime token. A BRAND NEW Clerk session is created and
  // used while the profile stays revoked. Its JWT is inside its entire validity
  // window, so this denial cannot be explained by token expiry — the gate must be
  // the local profile status, i.e. the documented 0ms stateless window. ---
  const { context: freshContext } = await signInContext(browser, farmer);
  const freshPage = await freshContext.newPage();
  offenders.push(...trackProductionRequests(freshPage));
  const freshProbe = await probeProtectedRoute(freshContext);
  expectRevocationRedirect(
    freshProbe,
    `${FARMER_PROTECTED_ROUTE} (fresh, unexpired session while the profile is revoked)`,
  );
  await freshPage.goto(FARMER_PROTECTED_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(freshPage.getByRole("heading", { name: FARMER_HEADING })).toHaveCount(0);
  await freshContext.close();

  // --- Leg 4: Clerk session revocation in isolation. This records the CURRENT
  // design honestly instead of asserting a stronger control than the app has.
  //
  // Clerk session JWTs are stateless, so revoking the session at Clerk does NOT
  // by itself invalidate an already-issued token. The request therefore stays
  // admitted for at most the token's remaining lifetime, which is exactly the
  // fallback documented in docs/security/REMEDIATION-RESULTS.md §7.1. The
  // authoritative control is profiles.status, proven by legs 2 and 3.
  //
  // What is asserted here: the residual window is BOUNDED by the session token's
  // remaining lifetime, and it is strictly inside the documented 60s ceiling.
  await setProfileStatus(admin, farmer.clerkUserId, "active");
  await page.goto(FARMER_PROTECTED_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: FARMER_HEADING }),
    "pre-condition: the session is usable again",
  ).toBeVisible({ timeout: 30_000 });

  // Capture the session token BEFORE revoking: Clerk may clear the cookie as part
// of the revocation response, and the token is what carries the TTL we measure.
  const sessionCookie = (await context.cookies()).find((c) => c.name.startsWith("__session"));
  expect(sessionCookie, "the authenticated session cookie must exist before revocation").toBeDefined();
  const remainingTtlSeconds = Math.floor((decodeJwtExp(sessionCookie!.value) - Date.now()) / 1000);

  await revokeSession(sessionId);
  const afterRevokeProbe = await probeProtectedRoute(context);

  expect(
    remainingTtlSeconds,
    "the residual stateless window must be strictly positive and bounded",
  ).toBeGreaterThan(0);
  expect(
    remainingTtlSeconds,
    `the residual stateless window must stay inside the documented 60s ceiling (was ${remainingTtlSeconds}s)`,
  ).toBeLessThanOrEqual(60);
  console.log(
    `      Clerk-session-revocation residual window: ${remainingTtlSeconds}s ` +
      `(probe status ${afterRevokeProbe.status}); the authoritative gate is profiles.status (legs 2-3).`,
  );

  expect(offenders, "no production host may ever be contacted").toEqual([]);

  await context.close();

  expect(await readProfileStatus(admin, farmer.clerkUserId), "profile restored to active").toBe("active");
});

test("REG-SEC-AUTH-001c: a revoked profile cannot execute the protected checkout mutation", async () => {
  await resetCart(admin, buyer.clerkUserId);
  await clearBuyerOrders(admin, buyer.clerkUserId);
  await provisionProduct(admin, {
    id: REVOCATION_PRODUCT,
    farmerClerkId: farmer.clerkUserId,
    name: "SEC-AUTH-001 Pechay",
    pricePerUnit: 120,
    quantity: 40,
    minOrderQuantity: 1,
  });

  // V4 business-owned cart: the row belongs to the buyer's business, not to the
  // buyer's Clerk id. business_clerk_id is still NOT NULL on the table, so it is
  // populated, but place_v4_checkout_orders locks and consumes by business_id.
  const { data: business, error: bizErr } = await admin
    .from("businesses")
    .select("id, status, can_buy")
    .eq("id", buyerBusinessId)
    .single();
  expect(bizErr, "buyer business lookup").toBeNull();
  expect(business?.status, "pre-condition: the buyer business is active").toBe("active");
  expect(business?.can_buy, "pre-condition: the buyer business can BUY").toBe(true);
  const { count: membershipCount } = await admin
    .from("business_members")
    .select("id", { count: "exact", head: true })
    .eq("business_id", buyerBusinessId)
    .eq("user_id", buyer.clerkUserId);
  expect(membershipCount, "pre-condition: the buyer is a member of the business").toBe(1);

  await admin.from("cart_items").delete().eq("business_id", buyerBusinessId);
  const { error: cartErr } = await admin.from("cart_items").insert({
    business_id: buyerBusinessId,
    business_clerk_id: buyer.clerkUserId,
    product_id: REVOCATION_PRODUCT,
    quantity: 3,
  });
  expect(cartErr, "V4 cart fixture insert").toBeNull();

  await setProfileStatus(admin, buyer.clerkUserId, "revoked");
  try {
    const ordersBefore = await countBusinessOrders(buyerBusinessId);
    const legacyOrdersBefore = await countBuyerOrders(admin, buyer.clerkUserId);
    const { jwt } = await createSessionToken(buyer.clerkUserId);

    // place_v4_checkout_orders checks, in order: identity, business membership,
    // business status + BUY capability, THEN the caller's profile status. The
    // "Account is revoked" refusal below is therefore only reachable once the
    // V4 fixture has passed every business check — it is the revocation, not a
    // broken fixture, that blocks the mutation.
    const response = await fetch(`${TEST_SUPABASE_URL}/rest/v1/rpc/place_v4_checkout_orders`, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_business_id: buyerBusinessId,
        p_orders: [
          {
            farmer_clerk_id: farmer.clerkUserId,
            fulfillment_type: "pickup",
            pickup_date: manilaTomorrow(),
            delivery_address: null,
            items: [{ product_id: REVOCATION_PRODUCT, quantity: 3 }],
          },
        ],
      }),
    });
    const body = await response.text();

    expect(response.ok, `a revoked profile must be refused, body was: ${body}`).toBe(false);
    expect(body, "the refusal must name the inactive account").toMatch(
      /account is revoked and cannot place orders/i,
    );
    expect(
      await countBusinessOrders(buyerBusinessId),
      "no order may be committed for the business by a revoked profile",
    ).toBe(ordersBefore);
    expect(
      await countBuyerOrders(admin, buyer.clerkUserId),
      "no order may be committed under the buyer's Clerk id either",
    ).toBe(legacyOrdersBefore);

    const { data: cartRow } = await admin
      .from("cart_items")
      .select("quantity")
      .eq("business_id", buyerBusinessId)
      .eq("product_id", REVOCATION_PRODUCT)
      .maybeSingle();
    expect(cartRow?.quantity, "the refused checkout must leave the business cart untouched").toBe(3);
  } finally {
    await setProfileStatus(admin, buyer.clerkUserId, "active");
  }

  expect(await readProfileStatus(admin, buyer.clerkUserId), "buyer profile restored to active").toBe("active");
});

// -----------------------------------------------------------------------------
// REG-SEC-AUTH-001d — the propagation path itself.
//
// 001a sets profiles.status directly, which proves the status gate but not the
// chain that is supposed to set that status. This leg drives the real chain:
//
//   Clerk session revocation  ->  session.revoked webhook
//                              ->  POST /api/webhooks/clerk (svix-signed)
//                              ->  verifyWebhook() accepts it
//                              ->  profiles.status = 'revoked'
//                              ->  the protected route denies the profile
//
// profiles.status is never written directly here; the only local write is the
// restore at the end of the test.
// -----------------------------------------------------------------------------
test("REG-SEC-AUTH-001d: a signed session.revoked webhook propagates from Clerk to profiles.status", async ({
  browser,
}) => {
  await setProfileStatus(admin, farmer.clerkUserId, "active");

  // 1. The event we deliver must describe a session that genuinely was revoked
  //    at Clerk, so revoke it there first.
  const { sessionId } = await createSessionToken(farmer.clerkUserId);
  await revokeSession(sessionId);

  const session = await readClerkSession(sessionId);
  expect(session.user_id, "the revoked session must belong to the test farmer").toBe(farmer.clerkUserId);
  expect(session.status, `the Clerk session must no longer be active (status: ${session.status})`).not.toBe(
    "active",
  );

  // 2. Control: revoking at Clerk alone must NOT have touched the local
  //    profile. Without this, the leg below could pass on a direct status write
  //    instead of the webhook carrying the state.
  expect(
    await readProfileStatus(admin, farmer.clerkUserId),
    "profile must still be active before the webhook is delivered",
  ).toBe("active");

  const payload = { type: "session.revoked", data: session };

  // 3. A forged (unsigned) delivery must be refused by verifyWebhook(), and the
  //    refusal must leave the profile untouched.
  const forged = await deliverClerkWebhook(payload, { sign: false });
  expect(forged.status, "an unsigned session.revoked payload must be rejected with 400").toBe(400);
  expect(
    await readProfileStatus(admin, farmer.clerkUserId),
    "a rejected delivery must not change profiles.status",
  ).toBe("active");

  // 4. The properly signed delivery must be accepted by the real endpoint.
  const accepted = await deliverClerkWebhook(payload, { sign: true });
  expect(
    accepted.status,
    `the signed session.revoked webhook must be accepted (body: ${accepted.body})`,
  ).toBe(200);

  // 5. The resulting database state, written by the route handler.
  expect(
    await readProfileStatus(admin, farmer.clerkUserId),
    "profiles.status must be 'revoked' after the signed session.revoked delivery",
  ).toBe("revoked");

  // 6. Close the chain: the webhook-revoked profile is denied the protected
  //    route, exactly as in REG-SEC-AUTH-001a.
  const { context } = await signInContext(browser, farmer);
  const probe = await probeProtectedRoute(context);
  expectRevocationRedirect(probe, `${FARMER_PROTECTED_ROUTE} (webhook-revoked profile)`);
  await context.close();

  await setProfileStatus(admin, farmer.clerkUserId, "active");
  expect(await readProfileStatus(admin, farmer.clerkUserId), "farmer profile restored to active").toBe("active");
});
// -----------------------------------------------------------------------------
// REG-SEC-AUTH-001e — V4 buyer routes.
//
// /orders, /cart and /checkout each stream behind a loading.tsx boundary, so a
// page-level redirect() could only ever emit a 200 + in-page meta refresh. The
// account-status gate in each segment's layout.tsx must instead answer with a
// real 307 before anything streams, and must never route an inactive account
// to /onboarding.
// -----------------------------------------------------------------------------
test("REG-SEC-AUTH-001e: V4 buyer routes keep an active buyer in place and give a revoked buyer a real 307", async ({
  browser,
}) => {
  await setProfileStatus(admin, buyer.clerkUserId, "active");

  const { context } = await signInContext(browser, buyer);
  const page = await context.newPage();
  const offenders = trackProductionRequests(page);

  try {
    // --- Active buyer: every route renders where it was requested. ---
    for (const route of BUYER_PROTECTED_ROUTES) {
      const probe = await probeProtectedRoute(context, route);
      expect(probe.status, `${route}: an active buyer must receive the route`).toBe(200);
      expect(probe.location, `${route}: an active buyer must not be redirected`).toBeNull();

      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route}: browser navigation must succeed`).toBe(200);
      const landed = new URL(page.url());
      expect(landed.pathname, `${route}: an active buyer stays on the requested route`).toBe(route);
      expect(landed.searchParams.get("revoked"), `${route}: no revocation flag`).toBeNull();
    }

    // --- Revoked buyer: a real 307 to the revocation sign-in, on every route. ---
    await setProfileStatus(admin, buyer.clerkUserId, "revoked");

    for (const route of BUYER_PROTECTED_ROUTES) {
      const startedAt = Date.now();
      const probe = await probeProtectedRoute(context, route);
      const denialMs = Date.now() - startedAt;
      expectRevocationRedirect(probe, route);
      expect(denialMs, `${route}: denial must be immediate (took ${denialMs}ms)`).toBeLessThanOrEqual(
        REVOCATION_DENIAL_BUDGET_MS,
      );

      // The browser must receive that same HTTP redirect as part of the
      // navigation (not a client-side hop after a 200 document).
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      const redirectedFrom = response?.request().redirectedFrom();
      expect(redirectedFrom, `${route}: the navigation must have been an HTTP redirect`).toBeTruthy();
      expect(new URL(redirectedFrom!.url()).pathname, `${route}: the redirect must originate at the route`).toBe(
        route,
      );
      const target = new URL(response!.url());
      expect(target.pathname, `${route}: the redirect must land on sign-in`).toBe("/sign-in");
      expect(target.searchParams.get("revoked"), `${route}: the landing must be flagged as a revocation`).toBe(
        "true",
      );
      expect(response!.status(), `${route}: the sign-in landing must render`).toBe(200);
    }

    // --- No redirect loop: the revocation target itself is not gated. ---
    const landing = await context.request.get("/sign-in?revoked=true", { maxRedirects: 0 });
    expect(landing.status(), "the revocation sign-in page must terminate the chain with a 200").toBe(200);
    expect(landing.headers()["location"], "the revocation sign-in page must not redirect again").toBeUndefined();
    for (const route of BUYER_PROTECTED_ROUTES) {
      // Following redirects throws on a loop (Playwright caps the chain).
      const followed = await context.request.get(route);
      expect(followed.status(), `${route}: the followed chain must terminate`).toBe(200);
      expect(new URL(followed.url()).pathname, `${route}: the followed chain must end on sign-in`).toBe("/sign-in");
    }
  } finally {
    await setProfileStatus(admin, buyer.clerkUserId, "active");
    await context.close();
  }

  expect(offenders, "no production host may ever be contacted").toEqual([]);
  expect(await readProfileStatus(admin, buyer.clerkUserId), "buyer profile restored to active").toBe("active");
});
