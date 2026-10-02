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
//                     mutation: the database refuses place_checkout_orders and no
//                     order is committed.
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

const FARMER_PROTECTED_ROUTE = "/farmer/orders";
const FARMER_HEADING = "Incoming Orders";
const REVOCATION_DENIAL_BUDGET_MS = 5_000;

let admin: SupabaseClient;
let buyer: Persona;
let farmer: Persona;
let originalFarmerStatus: string | null = null;
let originalBuyerStatus: string | null = null;

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
async function probeProtectedRoute(context: BrowserContext): Promise<SsrProbe> {
  const response = await context.request.get(FARMER_PROTECTED_ROUTE, { maxRedirects: 0 });
  return { status: response.status(), location: response.headers()["location"] ?? null };
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

  expect(deniedProbe.status, "a revoked profile must be redirected off the protected route").toBeGreaterThanOrEqual(300);
  expect(deniedProbe.status, "a revoked profile must be redirected off the protected route").toBeLessThan(400);
  expect(
    deniedProbe.location ?? "",
    "the redirect target must be the sign-in route flagged as a revocation",
  ).toMatch(/^\/sign-in\?revoked=true/);
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
  expect(
    freshProbe.location ?? "",
    "a fresh, unexpired session must still be denied while the profile is revoked",
  ).toMatch(/^\/sign-in\?revoked=true/);
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

  const { error: cartErr } = await admin.from("cart_items").upsert(
    { business_clerk_id: buyer.clerkUserId, product_id: REVOCATION_PRODUCT, quantity: 3 },
    { onConflict: "business_clerk_id,product_id" },
  );
  expect(cartErr, "cart fixture insert").toBeNull();

  await setProfileStatus(admin, buyer.clerkUserId, "revoked");
  try {
    const ordersBefore = await countBuyerOrders(admin, buyer.clerkUserId);
    const { jwt } = await createSessionToken(buyer.clerkUserId);

    const response = await fetch(`${TEST_SUPABASE_URL}/rest/v1/rpc/place_checkout_orders`, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      await countBuyerOrders(admin, buyer.clerkUserId),
      "no order may be committed by a revoked profile",
    ).toBe(ordersBefore);
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
  expect(
    probe.location ?? "",
    "a webhook-revoked profile must be denied the protected route",
  ).toMatch(/^\/sign-in\?revoked=true/);
  await context.close();

  await setProfileStatus(admin, farmer.clerkUserId, "active");
  expect(await readProfileStatus(admin, farmer.clerkUserId), "farmer profile restored to active").toBe("active");
});