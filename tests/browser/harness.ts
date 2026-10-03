// =============================================================================
// UMA Market — Browser regression suite shared harness
//
// SAFETY RULES (AGENTS.md §7, docs/security/SECURITY-TEST-ENVIRONMENT.md §9):
//   1. Credentials come EXCLUSIVELY from .env.security-test.local.
//   2. The app under test is launched with those credentials injected as real
//      process environment variables. Next.js resolves `process.env` FIRST and
//      only then falls back to .env files (see Next.js env load order), so the
//      security-test project always wins over the production .env.local, which
//      is never modified.
//   3. No secret is ever written to a file or printed. Only hosts and refs are
//      logged.
//   4. Every spec asserts that zero requests were issued to the production
//      Supabase ref or the production application host.
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Browser, BrowserContext } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { Webhook } from "standardwebhooks";
import {
  loadSecurityTestEnv,
  PROD_SUPABASE_REF,
  SECURITY_TEST_SUPABASE_REF,
  SECURITY_TEST_SUPABASE_URL,
} from "../../scripts/lib/safety-guard";

const env = loadSecurityTestEnv("browser-regression");

export const TEST_SUPABASE_URL = env.supabaseUrl;
export const SECURITY_TEST_HOST = `${SECURITY_TEST_SUPABASE_REF}.supabase.co`;
export const PROD_SUPABASE_HOST = `${PROD_SUPABASE_REF}.supabase.co`;

/** Production application host that the browser suite must never reach. */
export const PROD_APP_HOST = "uma.xalhexi.wtf";

export const E2E_PORT = Number(process.env.UMA_E2E_PORT ?? 3101);
// `localhost` (not 127.0.0.1): Next.js 16 blocks cross-origin access to dev
// resources for non-localhost hosts, which breaks Clerk's client-side bundle.
export const E2E_ORIGIN_HOST = "localhost";
export const E2E_BASE_URL = `http://${E2E_ORIGIN_HOST}:${E2E_PORT}`;

const clerkSecretKey = env.clerkSecretKey;

if (!clerkSecretKey) {
  throw new Error(
    "CLERK_SECRET_KEY is required in .env.security-test.local for the browser regression suite.",
  );
}

/**
 * Signing secret the app under test uses to verify Clerk webhook deliveries.
 *
 * Precedence:
 *   1. `CLERK_WEBHOOK_SIGNING_SECRET` from `.env.security-test.local`, when the
 *      isolated environment supplies one.
 *   2. Otherwise a value derived from the isolated Supabase credentials.
 *
 * Case 2 exists because the isolated environment intentionally ships no Clerk
 * webhook secret, and reading the one in `.env.local` is forbidden (it belongs
 * to production). The derivation is deterministic — the Playwright config
 * process and every worker process load the same env file, so they agree on the
 * same secret — while remaining unguessable from outside, since it is a hash of
 * a value that is never printed. Nothing here writes a secret to disk, and the
 * dev server can only ever receive it through its own process environment, so a
 * real Clerk delivery (which we never receive locally) is unaffected.
 */
export function clerkWebhookSigningSecret(): string {
  if (env.clerkWebhookSigningSecret) return env.clerkWebhookSigningSecret;
  const digest = createHash("sha256")
    .update(`${env.supabaseUrl}\u0000${env.secretKey}\u0000clerk-webhook-signing-secret`)
    .digest("base64");
  // standardwebhooks requires a base64 payload after the "whsec_" prefix.
  return `whsec_${digest}`;
}

/**
 * Environment handed to the Next.js dev server under test.
 *
 * Every variable is a real process variable, so it takes precedence over any
 * .env file Next.js would otherwise load.
 */
export function resolveAppEnv(): Record<string, string> {
  const resolved: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: TEST_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.anonKey,
    SUPABASE_SECRET_KEY: env.secretKey,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: env.clerkPublishableKey,
    CLERK_SECRET_KEY: clerkSecretKey,
    // Set explicitly (overriding any .env.local value) so webhook signature
    // verification on the dev server uses the isolated test secret that
    // deliverClerkWebhook() signs with — never a production secret.
    CLERK_WEBHOOK_SIGNING_SECRET: clerkWebhookSigningSecret(),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/",
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/onboarding",
  };

  if (resolved.NEXT_PUBLIC_SUPABASE_URL.includes(PROD_SUPABASE_REF)) {
    throw new Error("Refusing to start: resolved Supabase URL is the PRODUCTION project.");
  }
  if (resolved.NEXT_PUBLIC_SUPABASE_URL !== SECURITY_TEST_SUPABASE_URL) {
    throw new Error(
      `Refusing to start: resolved Supabase URL must be ${SECURITY_TEST_SUPABASE_URL}`,
    );
  }
  return resolved;
}

export function serviceClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// -----------------------------------------------------------------------------
// Clerk Backend API helpers (isolated test mechanism — no production auth)
// -----------------------------------------------------------------------------

const CLERK_API = "https://api.clerk.com/v1";

async function clerkFetch<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${CLERK_API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${clerkSecretKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Clerk Backend API ${pathname} failed: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export interface Persona {
  clerkUserId: string;
  email: string;
}

/**
 * Opens an isolated browser context authenticated as `persona`.
 *
 * A single-use Clerk sign-in token is minted through the Backend API and
 * redeemed by the browser at `/sign-in?__clerk_ticket=...`, which completes a
 * genuine Clerk handshake and leaves a genuine authenticated session in the
 * cookie jar. No UI credential entry and no committed credential is involved.
 */
export async function authenticatedContext(
  browser: Browser,
  persona: Persona,
): Promise<{ context: BrowserContext; sessionId: string }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const ticket = await createSignInTicket(persona.clerkUserId);
  await page.goto(`/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, {
    waitUntil: "domcontentloaded",
  });
  // Clerk completes the ticket exchange client-side; wait for the cookie to land.
  await page
    .waitForFunction(() => window.location.pathname !== "/sign-in", undefined, { timeout: 30_000 })
    .catch(() => undefined);
  await page.close();

  // Identify the Clerk session the handshake created, so a test can revoke it.
  const sessionId = await readActiveSessionId(persona.clerkUserId);
  return { context, sessionId };
}

/** Returns the id of the user's most recently active Clerk session. */
async function readActiveSessionId(clerkUserId: string): Promise<string> {
  const sessions = await clerkFetch<Array<{ id: string; status: string; ended_at: number | null }>>(
    `/sessions?user_id=${encodeURIComponent(clerkUserId)}&status=active&limit=1`,
  );
  const session = sessions[0];
  if (!session) {
    throw new Error(`No active Clerk session found for ${clerkUserId} after the sign-in handshake.`);
  }
  return session.id;
}

/**
 * Creates a single-use Clerk sign-in token for `clerkUserId`.
 *
 * Equivalent of the historical `/v1/tickets` endpoint, renamed to
 * `POST /v1/sign_in_tokens` in the current Clerk Backend API.
 */
export async function createSignInTicket(clerkUserId: string): Promise<string> {
  const { token } = await clerkFetch<{ token: string }>("/sign_in_tokens", {
    method: "POST",
    body: JSON.stringify({ user_id: clerkUserId, expires_in_seconds: 120 }),
  });
  return token;
}

/**
 * Creates a synthetic, ROLE-LESS Clerk test user (AUTHZ-10).
 *
 * The account exists only in the isolated Development instance, carries no
 * `publicMetadata.role`, and must be deleted by the caller's cleanup. A
 * role-less `user.created` event carries no profile write, so it cannot
 * mutate any database outside this test.
 */
export async function createSyntheticUser(prefix: string): Promise<Persona> {
  const email = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  // BAPI key is `email_address` (array). Addresses are created VERIFIED by
  // default, satisfying this instance's verify-at-sign-up requirement.
  const user = await clerkFetch<{ id: string }>("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      password: `Uma!Test-${randomUUID()}`,
    }),
  });
  return { clerkUserId: user.id, email };
}

/** Deletes a synthetic Clerk test user. Cleanup only; never throws on 404. */
export async function deleteClerkUser(clerkUserId: string): Promise<void> {
  const response = await fetch(`${CLERK_API}/users/${clerkUserId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${clerkSecretKey}` },
  });
  // 204 = deleted, 404 = already gone. Both are acceptable for cleanup.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Deleting Clerk test user failed: HTTP ${response.status}`);
  }
}

/** Reads a user's public metadata (AUTHZ-10 escalation assertions). */
export async function getPublicMetadata(clerkUserId: string): Promise<Record<string, unknown>> {
  const user = await clerkFetch<{ public_metadata: Record<string, unknown> | null }>(
    `/users/${clerkUserId}`,
  );
  return user.public_metadata ?? {};
}

const PERSONA_DEFAULTS = {
  business: { envKey: "UMA_E2E_BUSYER_EMAIL", fallback: "buyer.test@example.com" },
  farmer: { envKey: "UMA_E2E_FARMER_EMAIL", fallback: "farmer.test@example.com" },
  farmer2: { envKey: "UMA_E2E_FARMER2_EMAIL", fallback: "farmer2.test@example.com" },
} as const;

/**
 * Resolves a test persona's Clerk user id from its email address.
 *
 * Ids are looked up at run time instead of being committed, so the suite carries
 * no account identifiers and no credentials.
 */
export async function resolvePersona(role: keyof typeof PERSONA_DEFAULTS): Promise<Persona> {
  const { envKey, fallback } = PERSONA_DEFAULTS[role];
  const email = process.env[envKey] ?? fallback;

  const users = await clerkFetch<Array<{ id: string; email_addresses: Array<{ email_address: string }> }>>(
    `/users?email_address=${encodeURIComponent(email)}&limit=1`,
  );
  const user = users[0];
  if (!user) {
    throw new Error(
      `Clerk test account '${email}' not found in the development instance. ` +
        `Set ${envKey} to an existing test account.`,
    );
  }
  return { clerkUserId: user.id, email };
}

/**
 * Creates a real Clerk session for `clerkUserId` and returns its session JWT.
 *
 * The JWT is a genuine RS256 token minted by the Clerk development instance and
 * validated by the app's `clerkMiddleware()` against the instance JWKS, so a
 * browser context seeded with it is indistinguishable from a real sign-in.
 */
export async function createSessionToken(clerkUserId: string): Promise<{ sessionId: string; jwt: string }> {
  const { id: sessionId } = await clerkFetch<{ id: string }>("/sessions", {
    method: "POST",
    body: JSON.stringify({ user_id: clerkUserId }),
  });
  // Clerk mints the session token through POST /v1/sessions/{id}/tokens.
  const { jwt } = await clerkFetch<{ jwt: string }>(`/sessions/${sessionId}/tokens`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return { sessionId, jwt };
}

/** Revokes a Clerk session through the isolated Backend API. */
export async function revokeSession(sessionId: string): Promise<void> {
  const response = await fetch(`https://api.clerk.com/v1/sessions/${sessionId}/revoke`, {
    method: "POST",
    headers: { Authorization: `Bearer ${clerkSecretKey}`, "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Revoking Clerk session ${sessionId} failed: HTTP ${response.status}`);
  }
}

/** Minimal shape of a Clerk session as returned by the Backend API. */
export interface ClerkSession {
  id: string;
  user_id: string;
  status: string;
}

/** Reads a Clerk session object, so a webhook payload can carry its real `user_id`. */
export async function readClerkSession(sessionId: string): Promise<ClerkSession> {
  return clerkFetch<ClerkSession>(`/sessions/${sessionId}`);
}

// -----------------------------------------------------------------------------
// Clerk webhook delivery — drives the REAL /api/webhooks/clerk endpoint
// -----------------------------------------------------------------------------

export interface ClerkWebhookDelivery {
  status: number;
  body: string;
}

/**
 * Signs a payload with the isolated test secret and POSTs it to the running
 * app's `/api/webhooks/clerk` route over HTTP.
 *
 * This exercises the genuine delivery path — svix headers, `verifyWebhook()`,
 * the route's event switch and its database write — rather than mutating
 * `profiles.status` directly.
 *
 * The signing secret is never included in the returned value or in any log
 * line; callers should only surface `status` and, on failure, `body`.
 */
export async function deliverClerkWebhook(
  payload: Record<string, unknown>,
  options: { sign?: boolean } = {},
): Promise<ClerkWebhookDelivery> {
  const sign = options.sign ?? true;
  const body = JSON.stringify(payload);
  const msgId = `msg_${randomUUID()}`;
  const now = new Date();

  const signature = sign
    ? new Webhook(clerkWebhookSigningSecret()).sign(msgId, now, body)
    : "v1,invalid_signature_forged_by_test";

  const response = await fetch(`${E2E_BASE_URL}/api/webhooks/clerk`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": msgId,
      "svix-timestamp": Math.floor(now.getTime() / 1000).toString(),
      "svix-signature": signature,
    },
    body,
  });

  return { status: response.status, body: await response.text() };
}

// -----------------------------------------------------------------------------
// Fixture helpers — deterministic ids, always cleaned up
// -----------------------------------------------------------------------------

/** Deterministic UUID for fixture `namespace` + `ordinal`. */
export function fixtureUuid(namespace: string, ordinal: number): string {
  const NS: Record<string, string> = {
    e2e005: "c0000005-0000-4000-8000",
    secauth: "c0000006-0000-4000-8000",
  };
  const prefix = NS[namespace];
  if (!prefix) throw new Error(`Unknown fixture namespace: ${namespace}`);
  return `${prefix}-${ordinal.toString(16).padStart(12, "0")}`;
}

/** Deterministic product ids used by the E2E-005 checkout-race fixtures. */
export const CHECKOUT_PRODUCTS = {
  a: fixtureUuid("e2e005", 1),
  b: fixtureUuid("e2e005", 2),
};

/** Deterministic product id used by the SEC-AUTH-001 mutation-block fixture. */
export const REVOCATION_PRODUCT = fixtureUuid("secauth", 1);

/**
 * Ensures a profile row exists for a real Clerk test account.
 * `status` defaults to 'active' so the row can be revoked/restored per test.
 */
export async function upsertTestProfile(
  admin: SupabaseClient,
  clerkId: string,
  role: "business" | "farmer",
  fullName: string,
): Promise<void> {
  const { error } = await admin.from("profiles").upsert(
    {
      clerk_id: clerkId,
      role,
      full_name: fullName,
      business_name: `${fullName} Co`,
      city: "Butuan",
      status: "active",
      is_verified: true,
    },
    { onConflict: "clerk_id" },
  );
  if (error) throw new Error(`upsertTestProfile(${clerkId}) failed: ${error.message}`);
}

export async function setProfileStatus(
  admin: SupabaseClient,
  clerkId: string,
  status: "active" | "suspended" | "revoked",
): Promise<void> {
  const { error } = await admin.from("profiles").update({ status }).eq("clerk_id", clerkId);
  if (error) throw new Error(`setProfileStatus(${clerkId}) failed: ${error.message}`);
}

export async function readProfileStatus(admin: SupabaseClient, clerkId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("status")
    .eq("clerk_id", clerkId)
    .maybeSingle();
  if (error) throw new Error(`readProfileStatus(${clerkId}) failed: ${error.message}`);
  return data?.status ?? null;
}

export async function resetCart(admin: SupabaseClient, buyerClerkId: string): Promise<void> {
  await admin.from("cart_items").delete().eq("business_clerk_id", buyerClerkId);
}

export async function clearBuyerOrders(admin: SupabaseClient, buyerClerkId: string): Promise<void> {
  const { data, error } = await admin.from("orders").select("id").eq("business_clerk_id", buyerClerkId);
  if (error) throw new Error(`clearBuyerOrders select failed: ${error.message}`);
  const ids = (data ?? []).map((o) => o.id as string);
  if (ids.length === 0) return;
  await admin.from("order_items").delete().in("order_id", ids);
  await admin.from("orders").delete().in("id", ids);
}

export async function countBuyerOrders(admin: SupabaseClient, buyerClerkId: string): Promise<number> {
  const { count, error } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("business_clerk_id", buyerClerkId);
  if (error) throw new Error(`countBuyerOrders failed: ${error.message}`);
  return count ?? 0;
}

export async function readStock(admin: SupabaseClient, productId: string): Promise<number | null> {
  const { data, error } = await admin
    .from("products")
    .select("quantity_available")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new Error(`readStock failed: ${error.message}`);
  return data?.quantity_available ?? null;
}

export async function countCartItems(admin: SupabaseClient, buyerClerkId: string): Promise<number> {
  const { count, error } = await admin
    .from("cart_items")
    .select("id", { count: "exact", head: true })
    .eq("business_clerk_id", buyerClerkId);
  if (error) throw new Error(`countCartItems failed: ${error.message}`);
  return count ?? 0;
}

export async function provisionProduct(
  admin: SupabaseClient,
  product: {
    id: string;
    farmerClerkId: string;
    name: string;
    pricePerUnit: number;
    quantity: number;
    minOrderQuantity: number;
  },
): Promise<void> {
  const { data: category } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "vegetables")
    .maybeSingle();
  if (!category) {
    throw new Error("category 'vegetables' not found in the security-test database — run `npm run seed:demo`");
  }
  const { error } = await admin.from("products").upsert(
    {
      id: product.id,
      farmer_clerk_id: product.farmerClerkId,
      category_id: category.id,
      name: product.name,
      price_per_unit: product.pricePerUnit,
      unit: "kg",
      quantity_available: product.quantity,
      min_order_quantity: product.minOrderQuantity,
      status: "active",
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`provisionProduct(${product.id}) failed: ${error.message}`);
}

export async function cleanupProduct(admin: SupabaseClient, productId: string): Promise<void> {
  await admin.from("cart_items").delete().eq("product_id", productId);
  await admin.from("products").delete().eq("id", productId);
}

/** Today's date in Asia/Manila, as YYYY-MM-DD. */
export function manilaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** A date strictly in the future in Asia/Manila, as YYYY-MM-DD. */
export function manilaTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// -----------------------------------------------------------------------------
// Teardown — failures are reported, never swallowed
// -----------------------------------------------------------------------------

export interface CleanupStep {
  label: string;
  run: () => Promise<unknown>;
}

/**
 * Runs teardown steps, recording EVERY failure.
 *
 * The previous pattern (`await step.catch(() => undefined)`) made a broken
 * teardown invisible: the suite reported green while silently leaving revoked
 * profile statuses, stray orders and orphaned fixtures behind in the shared
 * security-test database.
 *
 * Behaviour:
 *   - every step is attempted, so one failure never skips the rest;
 *   - each failure is logged with its step label (no secrets are included);
 *   - if anything failed, an error is thrown so Playwright marks the suite
 *     failed instead of reporting a clean run.
 */
export async function runCleanup(steps: CleanupStep[]): Promise<void> {
  const failures: string[] = [];

  for (const step of steps) {
    try {
      await step.run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${step.label}: ${message}`);
      console.error(`[cleanup] FAILED — ${step.label}: ${message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `${failures.length} teardown step(s) failed; the run must not be reported as clean:\n` +
        failures.map((f) => `  - ${f}`).join("\n"),
    );
  }
}