// =============================================================================
// UMA Market — REG-E2E-005 regression suite (Multi-Tab Same-Account Checkout)
//
// Finding under regression: E2E-005 (docs/security/REMEDIATION-RESULTS.md §3).
// A buyer with two stale checkout tabs open could commit two orders and deduct
// stock twice from one logical cart state.
//
// The suite reproduces the three documented regression targets:
//   REG-E2E-005a  Two simultaneous same-account checkout tabs commit exactly ONE
//                 order and deduct inventory exactly once.
//   REG-E2E-005b  A direct place_v4_checkout_orders replay for an item that is NOT
//                 in the caller's cart is rejected by PostgreSQL.
//   REG-E2E-005c  A multi-farmer checkout stays atomic when one cart component
//                 disappears during contention: zero orders, stock untouched.
//
// Isolation: local Next.js dev server + isolated security-test Supabase project
// + Clerk development instance. Every test asserts that not a single request
// reached the production Supabase ref or the production application host.
// =============================================================================

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CHECKOUT_PRODUCTS,
  PROD_APP_HOST,
  PROD_SUPABASE_HOST,
  authenticatedContext,
  cleanupProduct,
  clearBuyerOrders,
  countBuyerOrders,
  countCartItems,
  createSessionToken,
  provisionProduct,
  readStock,
  resetCart,
  resolvePersona,
  runCleanup,
  serviceClient,
  TEST_SUPABASE_URL,
  manilaTomorrow,
  upsertTestProfile,
  type Persona,
} from "./harness";

const CART_CONFLICT_FRAGMENT = "already checked out in another window";

let admin: SupabaseClient;
let buyer: Persona;
let farmerA: Persona;
let farmerB: Persona;
let buyerBusinessId: string | null = null;

/** Records any request that reaches a production host. Must stay empty. */
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

/** Opens an isolated browser context authenticated as `persona`. */
async function signedInContext(browser: Browser, persona: Persona): Promise<BrowserContext> {
  const { context } = await authenticatedContext(browser, persona);
  return context;
}

/**
 * Blocks until the checkout form is actually hydrated.
 *
 * `domcontentloaded` only guarantees the server-rendered HTML exists. React event
 * handlers are attached during hydration, so an input event dispatched before
 * that point is silently dropped and the controlled state stays empty — which
 * looks exactly like a validation failure. Toggling the fulfillment selector is a
 * hydration probe: it only re-renders if a React handler is live.
 */
async function waitForHydration(page: Page): Promise<void> {
  const deliveryToggle = page.getByRole("button", { name: /Seller Delivery/i });
  const pickupToggle = page.getByRole("button", { name: /Pickup/i });

  await expect(async () => {
    await deliveryToggle.click({ timeout: 5_000 });
    await expect(page.locator("#delivery-address")).toBeVisible({ timeout: 5_000 });
    await pickupToggle.click({ timeout: 5_000 });
    await expect(page.locator("#delivery-address")).toHaveCount(0, { timeout: 5_000 });
  }).toPass({ timeout: 60_000, intervals: [250, 500, 1_000] });

  await expect(page.locator("#pickup-date")).toBeVisible({ timeout: 10_000 });
}

async function openCheckout(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/business/checkout", { waitUntil: "domcontentloaded" });
  await page.locator("#pickup-date").waitFor({ state: "visible", timeout: 30_000 });
  await waitForHydration(page);
  // React controlled input: set the value through the native setter and dispatch
  // the events React listens for, otherwise React state stays empty.
  await page.locator("#pickup-date").evaluate((el, value) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, manilaTomorrow());
  await expect(page.locator("#pickup-date")).toHaveValue(manilaTomorrow());
  await expect(page.locator("#pickup-date-error")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Place Order/i })).toBeEnabled();
  return page;
}

/**
 * Form-level error banner only. Field-level messages (e.g. the pickup-date
 * hint/error paragraph) also carry role="alert", so the selector is scoped to a
 * direct child of the form to avoid matching those.
 */
const FORM_ERROR_BANNER = "form > [role=alert]";

/** Fires the submit button in both pages as close to simultaneously as possible. */
async function submitBoth(pages: Page[]): Promise<void> {
  await Promise.all(
    pages.map((page) =>
      page.evaluate(() => {
        const button = document.querySelector("form button[type=submit]") as HTMLButtonElement | null;
        if (!button) throw new Error("submit button not found");
        button.click();
      }),
    ),
  );
}

type Outcome = "confirmation" | "error" | "timeout";

async function settle(page: Page): Promise<Outcome> {
  try {
    await page.waitForFunction(
      () =>
        window.location.pathname.includes("/checkout/confirmation") ||
        document.querySelector("form > [role=alert]") !== null,
      undefined,
      { timeout: 45_000 },
    );
  } catch {
    return "timeout";
  }
  return page.url().includes("/checkout/confirmation") ? "confirmation" : "error";
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = serviceClient();
  [buyer, farmerA, farmerB] = await Promise.all([
    resolvePersona("business"),
    resolvePersona("farmer"),
    resolvePersona("farmer2"),
  ]);

  await upsertTestProfile(admin, buyer.clerkUserId, "business", "E2E-005 Buyer");
  await upsertTestProfile(admin, farmerA.clerkUserId, "farmer", "E2E-005 Farmer A");
  await upsertTestProfile(admin, farmerB.clerkUserId, "farmer", "E2E-005 Farmer B");

  const { data: bMember } = await admin
    .from("business_members")
    .select("business_id")
    .eq("user_id", buyer.clerkUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  buyerBusinessId = bMember?.business_id ?? null;

  await provisionProduct(admin, {
    id: CHECKOUT_PRODUCTS.a,
    farmerClerkId: farmerA.clerkUserId,
    name: "E2E-005 Kangkong A",
    pricePerUnit: 50,
    quantity: 20,
    minOrderQuantity: 1,
  });
  await provisionProduct(admin, {
    id: CHECKOUT_PRODUCTS.b,
    farmerClerkId: farmerB.clerkUserId,
    name: "E2E-005 Ampalaya B",
    pricePerUnit: 60,
    quantity: 20,
    minOrderQuantity: 1,
  });
});

test.afterAll(async () => {
  if (!admin || !buyer) {
    const reason =
      "beforeAll did not complete — buyer orders, cart rows and the E2E-005 product fixtures " +
      "may still be present in the shared security-test database.";
    console.error(`[cleanup] FAILED — ${reason}`);
    throw new Error(reason);
  }

  await runCleanup([
    { label: "clear buyer orders", run: () => clearBuyerOrders(admin, buyer.clerkUserId) },
    { label: "reset buyer cart", run: () => resetCart(admin, buyer.clerkUserId) },
    { label: "remove E2E-005 product A fixture", run: () => cleanupProduct(admin, CHECKOUT_PRODUCTS.a) },
    { label: "remove E2E-005 product B fixture", run: () => cleanupProduct(admin, CHECKOUT_PRODUCTS.b) },
  ]);
});

test("REG-E2E-005a: two simultaneous same-account checkout tabs commit exactly one order and one stock deduction", async ({
  browser,
}) => {
  await resetCart(admin, buyer.clerkUserId);
  await clearBuyerOrders(admin, buyer.clerkUserId);
  await provisionProduct(admin, {
    id: CHECKOUT_PRODUCTS.a,
    farmerClerkId: farmerA.clerkUserId,
    name: "E2E-005 Kangkong A",
    pricePerUnit: 50,
    quantity: 20,
    minOrderQuantity: 1,
  });

  const { error: cartErr } = await admin.from("cart_items").insert({
    business_id: buyerBusinessId,
    business_clerk_id: buyer.clerkUserId,
    product_id: CHECKOUT_PRODUCTS.a,
    quantity: 10,
  });
  expect(cartErr, "cart fixture insert").toBeNull();

  const stockBefore = await readStock(admin, CHECKOUT_PRODUCTS.a);
  expect(stockBefore, "stock before race").toBe(20);

  // Two INDEPENDENT browser contexts => two separate cookie jars, same account.
  const [contextA, contextB] = await Promise.all([
    signedInContext(browser, buyer),
    signedInContext(browser, buyer),
  ]);

  const offenders: string[] = [];
  const pageA = await openCheckout(contextA);
  const pageB = await openCheckout(contextB);
  offenders.push(...trackProductionRequests(pageA), ...trackProductionRequests(pageB));

  await submitBoth([pageA, pageB]);

  const [outcomeA, outcomeB] = await Promise.all([settle(pageA), settle(pageB)]);
  const alertA = await pageA.locator(FORM_ERROR_BANNER).first().innerText().catch(() => "<none>");
  const alertB = await pageB.locator("form [role=alert]").first().innerText().catch(() => "<none>");
  const outcomes = [outcomeA, outcomeB].sort();

  expect(
    outcomes,
    `exactly one tab must reach confirmation and the other must surface the conflict (got ${outcomeA} / ${outcomeB}); alerts: A="${alertA}" B="${alertB}"`,
  ).toEqual(["confirmation", "error"]);

  const loser = outcomeA === "error" ? pageA : pageB;
  const winner = outcomeA === "confirmation" ? pageA : pageB;

  // --- Legitimate winning path ---
  await expect(
    winner,
    "the winning tab must land on the order confirmation screen",
  ).toHaveURL(/\/(business\/)?checkout\/confirmation\//);

  // --- Conflict is handled safely and legibly ---
  const alert = loser.locator(FORM_ERROR_BANNER).first();
  await expect(alert, "the losing tab must render an inline error banner").toBeVisible();
  await expect(alert).toContainText(CART_CONFLICT_FRAGMENT);
  await expect(
    loser.getByRole("link", { name: /Return to Cart/i }),
    "the losing tab must offer a route back to the cart",
  ).toBeVisible();
  await expect(loser, "the losing tab must NOT reach a confirmation screen").not.toHaveURL(
    /\/(business\/)?checkout\/confirmation\//,
  );

  // --- Database invariants: no duplicate order, no double deduction ---
  expect(await countBuyerOrders(admin, buyer.clerkUserId), "exactly one order may exist").toBe(1);
  expect(await readStock(admin, CHECKOUT_PRODUCTS.a), "stock must be deducted exactly once").toBe(10);
  expect(await countCartItems(admin, buyer.clerkUserId), "the cart must be fully consumed").toBe(0);

  expect(offenders, "no production host may ever be contacted").toEqual([]);

  await contextA.close();
  await contextB.close();
});

test("REG-E2E-005b: a direct place_v4_checkout_orders replay for an item absent from the caller's cart is rejected", async () => {
  // The cart is empty after REG-E2E-005a consumed it, so this is exactly the
  // stale-tab replay the RPC must refuse.
  expect(await countCartItems(admin, buyer.clerkUserId), "pre-condition: cart is empty").toBe(0);
  const ordersBefore = await countBuyerOrders(admin, buyer.clerkUserId);
  const stockBefore = await readStock(admin, CHECKOUT_PRODUCTS.a);

  // The V4 RPC requires the caller's business (idempotent provisioning).
  const { data: businessId, error: provisionError } = await admin.rpc("provision_owner_business", {
    p_clerk_id: buyer.clerkUserId,
  });
  expect(provisionError ?? null, "buyer business must be provisionable").toBeNull();
  expect(businessId, "buyer business id must exist").toBeTruthy();

  const { jwt } = await createSessionToken(buyer.clerkUserId);
  const rpcUrl = `${TEST_SUPABASE_URL}/rest/v1/rpc/place_v4_checkout_orders`;
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_business_id: businessId,
      p_orders: [
        {
          farmer_clerk_id: farmerA.clerkUserId,
          fulfillment_type: "pickup",
          pickup_date: manilaTomorrow(),
          delivery_address: null,
          items: [{ product_id: CHECKOUT_PRODUCTS.a, quantity: 5 }],
        },
      ],
    }),
  });
  const body = await response.text();

  expect(response.ok, `RPC must fail, body was: ${body}`).toBe(false);
  expect(body, "the RPC must name the missing cart item").toMatch(
    /was not found or has already been checked out|already checked out or removed/i,
  );

  expect(await countBuyerOrders(admin, buyer.clerkUserId), "no order may be created by the replay").toBe(
    ordersBefore,
  );
  expect(await readStock(admin, CHECKOUT_PRODUCTS.a), "stock must be untouched by the replay").toBe(stockBefore);
});

test("REG-E2E-005c: a multi-farmer checkout stays atomic when one cart component disappears mid-contention", async ({
  browser,
}) => {
  await resetCart(admin, buyer.clerkUserId);
  await clearBuyerOrders(admin, buyer.clerkUserId);
  await provisionProduct(admin, {
    id: CHECKOUT_PRODUCTS.a,
    farmerClerkId: farmerA.clerkUserId,
    name: "E2E-005 Kangkong A",
    pricePerUnit: 50,
    quantity: 20,
    minOrderQuantity: 1,
  });
  await provisionProduct(admin, {
    id: CHECKOUT_PRODUCTS.b,
    farmerClerkId: farmerB.clerkUserId,
    name: "E2E-005 Ampalaya B",
    pricePerUnit: 60,
    quantity: 20,
    minOrderQuantity: 1,
  });

  const { error: cartErr } = await admin.from("cart_items").insert([
    {
      business_id: buyerBusinessId,
      business_clerk_id: buyer.clerkUserId,
      product_id: CHECKOUT_PRODUCTS.a,
      quantity: 2,
    },
    {
      business_id: buyerBusinessId,
      business_clerk_id: buyer.clerkUserId,
      product_id: CHECKOUT_PRODUCTS.b,
      quantity: 2,
    },
  ]);
  expect(cartErr, "two-farmer cart fixture insert").toBeNull();

  const stockABefore = await readStock(admin, CHECKOUT_PRODUCTS.a);
  const stockBBefore = await readStock(admin, CHECKOUT_PRODUCTS.b);

  const context = await signedInContext(browser, buyer);
  const page = await openCheckout(context);
  const offenders = trackProductionRequests(page);

  // Farmer B's cart row disappears AFTER the page rendered its cart snapshot,
  // exactly like another window emptying the cart mid-checkout.
  const { error: delErr } = await admin
    .from("cart_items")
    .delete()
    .eq("business_clerk_id", buyer.clerkUserId)
    .eq("product_id", CHECKOUT_PRODUCTS.b);
  expect(delErr, "simulate concurrent cart removal").toBeNull();

  await submitBoth([page]);
  const outcome = await settle(page);

  expect(outcome, "the checkout must be rejected, not silently half-completed").toBe("error");
  await expect(page.locator(FORM_ERROR_BANNER).first()).toContainText(CART_CONFLICT_FRAGMENT);
  await expect(page).not.toHaveURL(/\/(business\/)?checkout\/confirmation/);

  expect(await countBuyerOrders(admin, buyer.clerkUserId), "the whole transaction must roll back").toBe(0);
  expect(await readStock(admin, CHECKOUT_PRODUCTS.a), "farmer A stock must be untouched").toBe(stockABefore);
  expect(await readStock(admin, CHECKOUT_PRODUCTS.b), "farmer B stock must be untouched").toBe(stockBBefore);

  expect(offenders, "no production host may ever be contacted").toEqual([]);

  await context.close();
});