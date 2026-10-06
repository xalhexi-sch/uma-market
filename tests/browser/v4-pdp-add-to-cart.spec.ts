// =============================================================================
// UMA Market — V4 PDP → Add to Cart (business-owned cart) Browser Verification
//
// Drives the real /products/[id] AddToCartControls → addToBusinessCart server
// action against the isolated security-test environment. Verifies:
// 1. Anonymous visitors get the sign-in CTA, not cart controls.
// 2. PDP add writes one row to the active business cart (business_id set server-side).
// 3. Repeat add increments the same row.
// 4. Concurrent adds from two tabs both land (no lost update, no duplicate row).
// 5. Cart total above stock is rejected and leaves the row unchanged.
// 6. The same product added under a second business stays in a separate cart.
// 7. A non-member or suspended business in the active-business cookie is never written.
// 8. A SELL-only active business is rejected (BUY capability required).
// 9. Checkout succeeds for a cart filled from the PDP.
// =============================================================================

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  E2E_BASE_URL,
  PROD_APP_HOST,
  PROD_SUPABASE_HOST,
  authenticatedContext,
  manilaTomorrow,
  provisionProduct,
  readStock,
  resolvePersona,
  runCleanup,
  serviceClient,
  upsertTestProfile,
  type Persona,
} from "./harness";

const ACTIVE_BUSINESS_COOKIE = "uma_active_business_id";

const fixtureId = (n: number) => `d4000005-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const IDS = {
  product: fixtureId(1),
  fallbackBusiness: fixtureId(0x10),
  secondBusiness: fixtureId(0x20), // buyer STAFF, can_buy
  suspendedBusiness: fixtureId(0x30), // buyer STAFF, suspended
  sellOnlyBusiness: fixtureId(0x40), // buyer STAFF, can_buy = false
  foreignBusiness: fixtureId(0x50), // buyer is not a member
};

const FIXTURE_BUSINESSES = [
  IDS.secondBusiness,
  IDS.suspendedBusiness,
  IDS.sellOnlyBusiness,
  IDS.foreignBusiness,
];

const PRODUCT_NAME = "V4 PDP Cart Test Calamansi";
const STOCK = 20;
const MOQ = 2;

let admin: SupabaseClient;
let buyer: Persona;
let farmer: Persona;
/** The business the resolver selects with no cookie (first active OWNER membership). */
let defaultBusinessId: string;
let createdFallbackBusiness = false;

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

async function setActiveBusiness(context: BrowserContext, businessId: string): Promise<void> {
  await context.addCookies([
    { name: ACTIVE_BUSINESS_COOKIE, value: businessId, url: E2E_BASE_URL, httpOnly: true, sameSite: "Lax" },
  ]);
}

/** Opens the PDP and waits until the client controls are hydrated (quantity = MOQ). */
async function openPdp(page: Page): Promise<void> {
  await page.goto(`/products/${IDS.product}`, { waitUntil: "domcontentloaded" });
  const group = page.getByRole("group", { name: "Quantity in kg" });
  const increase = page.getByRole("button", { name: "Increase quantity" });
  await expect(async () => {
    await increase.click();
    await expect(group).toContainText("250.00", { timeout: 2_000 }); // 2.5 kg × ₱100
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(group).toContainText("200.00"); // back to MOQ: 2 kg × ₱100
}

async function clickAddToCart(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add to Cart" }).click();
}

async function expectStatus(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.getByRole("status").filter({ hasText: text }).first()).toBeVisible();
}

async function cartRows(productId = IDS.product) {
  const { data, error } = await admin
    .from("cart_items")
    .select("id, business_id, business_clerk_id, quantity")
    .eq("product_id", productId);
  if (error) throw new Error(`cartRows failed: ${error.message}`);
  return data ?? [];
}

async function deleteOrdersForProduct(): Promise<void> {
  const { data, error } = await admin.from("order_items").select("order_id").eq("product_id", IDS.product);
  if (error) throw new Error(`order lookup failed: ${error.message}`);
  const orderIds = [...new Set((data ?? []).map((r) => r.order_id as string))];
  if (orderIds.length === 0) return;
  const { error: itemsErr } = await admin.from("order_items").delete().in("order_id", orderIds);
  if (itemsErr) throw new Error(`order_items delete failed: ${itemsErr.message}`);
  const { error: ordersErr } = await admin.from("orders").delete().in("id", orderIds);
  if (ordersErr) throw new Error(`orders delete failed: ${ordersErr.message}`);
}

test.beforeAll(async () => {
  admin = serviceClient();
  [buyer, farmer] = await Promise.all([resolvePersona("business"), resolvePersona("farmer")]);
  await upsertTestProfile(admin, buyer.clerkUserId, "business", "PDP Buyer");
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "PDP Cart Farm");

  // Mirror resolveActiveBusinessContext's no-cookie fallback: first active OWNER membership.
  const { data: memberships, error } = await admin
    .from("business_members")
    .select("business_id, role, created_at, businesses!inner(id, status)")
    .eq("user_id", buyer.clerkUserId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`membership lookup failed: ${error.message}`);
  const active = (memberships ?? []).filter((m) => {
    const biz = (Array.isArray(m.businesses) ? m.businesses[0] : m.businesses) as { status?: string } | null;
    return biz?.status === "active" && !FIXTURE_BUSINESSES.includes(m.business_id);
  });
  const owner = active.find((m) => m.role === "OWNER") ?? active[0];

  if (owner) {
    defaultBusinessId = owner.business_id;
  } else {
    defaultBusinessId = IDS.fallbackBusiness;
    createdFallbackBusiness = true;
    await admin.from("businesses").upsert({
      id: defaultBusinessId,
      name: "PDP Buyer Fallback Co",
      can_buy: true,
      can_sell: false,
      status: "active",
    });
    await admin.from("business_members").upsert(
      { business_id: defaultBusinessId, user_id: buyer.clerkUserId, role: "OWNER" },
      { onConflict: "business_id,user_id" }
    );
  }
  await admin.from("businesses").update({ can_buy: true, status: "active" }).eq("id", defaultBusinessId);

  const { error: bizErr } = await admin.from("businesses").upsert([
    { id: IDS.secondBusiness, name: "PDP Second Buyer Co", can_buy: true, can_sell: false, status: "active" },
    { id: IDS.suspendedBusiness, name: "PDP Suspended Co", can_buy: true, can_sell: false, status: "suspended" },
    { id: IDS.sellOnlyBusiness, name: "PDP Sell Only Farm", can_buy: false, can_sell: true, status: "active" },
    { id: IDS.foreignBusiness, name: "PDP Foreign Co", can_buy: true, can_sell: false, status: "active" },
  ]);
  if (bizErr) throw new Error(`business fixtures failed: ${bizErr.message}`);

  const { error: memberErr } = await admin.from("business_members").upsert(
    [
      { business_id: IDS.secondBusiness, user_id: buyer.clerkUserId, role: "STAFF" },
      { business_id: IDS.suspendedBusiness, user_id: buyer.clerkUserId, role: "STAFF" },
      { business_id: IDS.sellOnlyBusiness, user_id: buyer.clerkUserId, role: "STAFF" },
      { business_id: IDS.foreignBusiness, user_id: farmer.clerkUserId, role: "OWNER" },
    ],
    { onConflict: "business_id,user_id" }
  );
  if (memberErr) throw new Error(`membership fixtures failed: ${memberErr.message}`);

  // Checkout reads the whole business cart; start it empty.
  await admin.from("cart_items").delete().eq("business_id", defaultBusinessId);

  await provisionProduct(admin, {
    id: IDS.product,
    farmerClerkId: farmer.clerkUserId,
    name: PRODUCT_NAME,
    pricePerUnit: 100,
    quantity: STOCK,
    minOrderQuantity: MOQ,
  });
});

test.afterAll(async () => {
  await runCleanup([
    { label: "delete fixture orders", run: deleteOrdersForProduct },
    {
      label: "delete fixture cart rows",
      run: async () => {
        const { error } = await admin.from("cart_items").delete().eq("product_id", IDS.product);
        if (error) throw new Error(error.message);
      },
    },
    {
      label: "delete fixture memberships",
      run: async () => {
        const { error } = await admin.from("business_members").delete().in("business_id", FIXTURE_BUSINESSES);
        if (error) throw new Error(error.message);
      },
    },
    {
      label: "delete fixture businesses",
      run: async () => {
        const ids = createdFallbackBusiness ? [...FIXTURE_BUSINESSES, IDS.fallbackBusiness] : FIXTURE_BUSINESSES;
        const { error } = await admin.from("businesses").delete().in("id", ids);
        if (error) throw new Error(error.message);
      },
    },
    {
      label: "delete fixture product",
      run: async () => {
        const { error } = await admin.from("products").delete().eq("id", IDS.product);
        if (error) throw new Error(error.message);
      },
    },
  ]);
});

test.describe.serial("V4 PDP → Add to Cart", () => {
  test("1. Anonymous visitor sees the sign-in CTA instead of cart controls", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    await page.goto(`/products/${IDS.product}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Add to Cart" })).toHaveCount(0);
    await expect(
      page.locator(`a[href="/sign-in?redirect_url=/products/${IDS.product}"]`).first()
    ).toBeVisible();

    expect(offenders).toHaveLength(0);
    await context.close();
  });

  test("2. PDP add writes one business-owned cart row", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    await openPdp(page);
    await clickAddToCart(page);
    await expectStatus(page, `"${PRODUCT_NAME}" added to cart.`);

    const rows = await cartRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].business_id).toBe(defaultBusinessId);
    expect(rows[0].business_clerk_id).toBe(buyer.clerkUserId);
    expect(rows[0].quantity).toBe(MOQ);

    expect(offenders).toHaveLength(0);
    await context.close();
  });

  test("3. Repeat add increments the same row", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const before = await cartRows();

    await openPdp(page);
    await clickAddToCart(page);
    await expectStatus(page, "added to cart");

    const rows = await cartRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(before[0].id);
    expect(rows[0].quantity).toBe(MOQ * 2);
    await context.close();
  });

  test("4. Concurrent adds from two tabs both land on one row", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const [pageA, pageB] = await Promise.all([context.newPage(), context.newPage()]);
    const before = (await cartRows())[0].quantity;

    await Promise.all([openPdp(pageA), openPdp(pageB)]);
    await Promise.all([clickAddToCart(pageA), clickAddToCart(pageB)]);
    await Promise.all([expectStatus(pageA, "added to cart"), expectStatus(pageB, "added to cart")]);

    const rows = await cartRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(before + MOQ * 2);
    await context.close();
  });

  test("5. Cart total above stock is rejected and the row is unchanged", async ({ browser }) => {
    const [row] = await cartRows();
    await admin.from("cart_items").update({ quantity: STOCK - 1 }).eq("id", row.id);

    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    await openPdp(page);
    await clickAddToCart(page);
    await expectStatus(page, `You already have ${STOCK - 1} kg in your cart. Only ${STOCK} kg available.`);

    const rows = await cartRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(STOCK - 1);

    await admin.from("cart_items").update({ quantity: MOQ }).eq("id", row.id);
    await context.close();
  });

  test("6. Same product under a second business stays in a separate cart", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    await setActiveBusiness(context, IDS.secondBusiness);
    const page = await context.newPage();

    await openPdp(page);
    await clickAddToCart(page);
    await expectStatus(page, "added to cart");

    const rows = await cartRows();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.business_id === defaultBusinessId)?.quantity).toBe(MOQ);
    expect(rows.find((r) => r.business_id === IDS.secondBusiness)?.quantity).toBe(MOQ);

    await admin.from("cart_items").delete().eq("business_id", IDS.secondBusiness);
    await context.close();
  });

  for (const [label, businessId] of [
    ["non-member", IDS.foreignBusiness],
    ["suspended", IDS.suspendedBusiness],
  ] as const) {
    test(`7. A ${label} business in the cookie is never written`, async ({ browser }) => {
      const { context } = await authenticatedContext(browser, buyer);
      await setActiveBusiness(context, businessId);
      const page = await context.newPage();
      const before = (await cartRows()).find((r) => r.business_id === defaultBusinessId)?.quantity ?? 0;

      await openPdp(page);
      await clickAddToCart(page);
      // The resolver ignores a cookie the user cannot act under and uses the default business.
      await expectStatus(page, "added to cart");

      const rows = await cartRows();
      expect(rows.some((r) => r.business_id === businessId)).toBe(false);
      expect(rows.find((r) => r.business_id === defaultBusinessId)?.quantity).toBe(before + MOQ);

      await admin
        .from("cart_items")
        .update({ quantity: MOQ })
        .eq("business_id", defaultBusinessId)
        .eq("product_id", IDS.product);
      await context.close();
    });
  }

  test("8. SELL-only active business is rejected", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    await setActiveBusiness(context, IDS.sellOnlyBusiness);
    const page = await context.newPage();
    const before = await cartRows();

    await openPdp(page);
    await clickAddToCart(page);
    await expectStatus(page, "This business does not have buying capability.");

    const rows = await cartRows();
    expect(rows.some((r) => r.business_id === IDS.sellOnlyBusiness)).toBe(false);
    expect(rows).toEqual(before);
    await context.close();
  });

  test("9. Checkout succeeds for a cart filled from the PDP", async ({ browser }) => {
    await admin.from("cart_items").delete().eq("business_id", defaultBusinessId);
    const stockBefore = await readStock(admin, IDS.product);

    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    await openPdp(page);
    await clickAddToCart(page);
    await expectStatus(page, "added to cart");

    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    const form = page.getByTestId("v4-checkout-form");
    await expect(form).toContainText(PRODUCT_NAME);
    const pickupDate = page.locator("#pickup-date");
    const placeOrder = page.getByTestId("v4-place-order-btn");
    const deliveryToggle = form.getByRole("button", { name: /Seller Delivery/i });
    const pickupToggle = form.getByRole("button", { name: /Pickup/i });
    const deliveryAddress = page.locator("#delivery-address");

    // fill() only sets the DOM value of <input type="date"> — React's onChange
    // never fires, so the controlled state stays empty and submit rejects it.
    // Set through the native setter (as in e2e-005-checkout-race.spec.ts), after
    // proving hydration via the fulfillment toggles, then verify the value
    // survives an unmount/remount, i.e. it lives in React state, not just the DOM.
    await expect(async () => {
      await deliveryToggle.click({ timeout: 5_000 });
      await expect(deliveryAddress).toBeVisible({ timeout: 5_000 });
      await pickupToggle.click({ timeout: 5_000 });
      await expect(deliveryAddress).toHaveCount(0, { timeout: 5_000 });

      await pickupDate.evaluate((el, value) => {
        const input = el as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, manilaTomorrow());

      await deliveryToggle.click({ timeout: 5_000 });
      await pickupToggle.click({ timeout: 5_000 });
      await expect(pickupDate).toHaveValue(manilaTomorrow(), { timeout: 3_000 });
    }).toPass({ timeout: 60_000 });

    await placeOrder.click();
    await expect(page).toHaveURL(/\/checkout\/confirmation/, { timeout: 60_000 });

    const { data: items, error } = await admin
      .from("order_items")
      .select("quantity, order:orders(business_id, placed_by_user_id)")
      .eq("product_id", IDS.product);
    expect(error).toBeNull();
    expect(items).toHaveLength(1);
    const order = (Array.isArray(items![0].order) ? items![0].order[0] : items![0].order) as {
      business_id: string;
      placed_by_user_id: string;
    };
    expect(items![0].quantity).toBe(MOQ);
    expect(order.business_id).toBe(defaultBusinessId);
    expect(order.placed_by_user_id).toBe(buyer.clerkUserId);

    expect((await cartRows()).filter((r) => r.business_id === defaultBusinessId)).toHaveLength(0);
    expect(await readStock(admin, IDS.product)).toBe((stockBefore ?? 0) - MOQ);

    expect(offenders).toHaveLength(0);
    await context.close();
  });
});
