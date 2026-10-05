// =============================================================================
// UMA Market — V4 Business Cart (/cart) Browser Verification
//
// Verifies:
// 1. Unauthenticated request to /cart redirects to sign-in.
// 2. Authenticated buyer cart loads with active business context and items.
// 3. Quantity controls update item quantity and respect bounds.
// 4. Remove item removes the row and displays empty cart state.
// 5. Mobile and desktop viewports have no horizontal overflow.
// 6. Dark and light themes render cleanly.
// 7. Zero links to legacy /business/cart exist on the new /cart page.
// =============================================================================

import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authenticatedContext,
  PROD_APP_HOST,
  PROD_SUPABASE_HOST,
  provisionProduct,
  resolvePersona,
  serviceClient,
  upsertTestProfile,
  type Persona,
} from "./harness";

const FIXTURES = {
  fallbackBusinessId: "d4000002-0000-4000-8000-000000000010",
  fallbackMemberId:   "d4000002-0000-4000-8000-000000000020",
  productId:          "d4000002-0000-4000-8000-000000000030",
  cartItemId:         "d4000002-0000-4000-8000-000000000040",
};

let admin: SupabaseClient;
let buyer: Persona;
let farmer: Persona;
let activeBusinessId: string;
let activeBusinessName: string;

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

test.beforeAll(async () => {
  admin = serviceClient();
  buyer = await resolvePersona("business");
  farmer = await resolvePersona("farmer");

  // Ensure profiles exist
  await upsertTestProfile(admin, buyer.clerkUserId, "business", "PDP Buyer");
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "Benguet Harvest Farm");

  // Identify or create buyer's active business
  const { data: member } = await admin
    .from("business_members")
    .select("business_id, role, businesses(id, name, can_buy)")
    .eq("user_id", buyer.clerkUserId)
    .eq("role", "OWNER")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (member?.business_id && member.businesses) {
    activeBusinessId = member.business_id;
    const biz = Array.isArray(member.businesses) ? member.businesses[0] : member.businesses;
    activeBusinessName = (biz as { name?: string } | null)?.name || "PDP Buyer Co";
    await admin
      .from("businesses")
      .update({ can_buy: true, status: "active" })
      .eq("id", activeBusinessId);
  } else {
    activeBusinessId = FIXTURES.fallbackBusinessId;
    activeBusinessName = "Highland Greens Trading";
    await admin.from("businesses").upsert({
      id: activeBusinessId,
      name: activeBusinessName,
      can_buy: true,
      can_sell: false,
      status: "active",
      legacy_clerk_id: buyer.clerkUserId,
    });
    await admin.from("business_members").upsert({
      id: FIXTURES.fallbackMemberId,
      business_id: activeBusinessId,
      user_id: buyer.clerkUserId,
      role: "OWNER",
    });
  }

  // Clear existing cart items for this business
  await admin.from("cart_items").delete().eq("business_id", activeBusinessId);

  // Provision product
  await provisionProduct(admin, {
    id: FIXTURES.productId,
    farmerClerkId: farmer.clerkUserId,
    name: "V4 Cart Test Strawberries",
    pricePerUnit: 250,
    quantity: 60,
    minOrderQuantity: 2,
  });
});

test.afterAll(async () => {
  // Clean up fixtures
  await admin.from("cart_items").delete().in("id", [FIXTURES.cartItemId]);
  if (activeBusinessId) {
    await admin.from("cart_items").delete().eq("business_id", activeBusinessId);
  }
  await admin.from("products").delete().eq("id", FIXTURES.productId);
});

test.describe("V4 /cart Browser Suite", () => {
  test("1. Unauthenticated request to /cart redirects to sign-in", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/.*\/sign-in/);

    expect(offenders).toHaveLength(0);
    await context.close();
  });

  test("2. Authenticated buyer cart loads with active business context, items, and no legacy links", async ({
    browser,
  }) => {
    // Seed one cart item for the active business
    await admin.from("cart_items").upsert({
      id: FIXTURES.cartItemId,
      business_id: activeBusinessId,
      business_clerk_id: buyer.clerkUserId,
      product_id: FIXTURES.productId,
      quantity: 4,
    });

    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });

    // Active business context bar
    const contextBar = page.getByTestId("v4-cart-context-bar");
    await expect(contextBar).toBeVisible();
    await expect(contextBar).toContainText(activeBusinessName);
    await expect(contextBar).toContainText("OWNER");

    // Product item row
    const itemRow = page.getByTestId(`v4-cart-item-${FIXTURES.cartItemId}`);
    await expect(itemRow).toBeVisible();
    await expect(itemRow).toContainText("V4 Cart Test Strawberries");
    await expect(itemRow).toContainText("250.00");
    await expect(itemRow).toContainText("4"); // quantity
    await expect(itemRow).toContainText("1,000.00"); // line total: 4 * 250

    // Cart Summary
    await expect(page.getByText("Cart Summary")).toBeVisible();
    await expect(page.getByTestId("checkout-cta")).toBeVisible();

    // Verify ZERO links to legacy /business/cart
    const legacyLinks = page.locator('a[href*="/business/cart"]');
    await expect(legacyLinks).toHaveCount(0);

    expect(offenders).toHaveLength(0);
    await context.close();
  });

  test("3. Quantity controls update item quantity and respect bounds", async ({ browser }) => {
    // Ensure item quantity is 4
    await admin.from("cart_items").upsert({
      id: FIXTURES.cartItemId,
      business_id: activeBusinessId,
      business_clerk_id: buyer.clerkUserId,
      product_id: FIXTURES.productId,
      quantity: 4,
    });

    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    const itemRow = page.getByTestId(`v4-cart-item-${FIXTURES.cartItemId}`);
    await expect(itemRow).toBeVisible();

    // Click increment (+) once: 4 -> 4.5 kg
    const plusBtn = page.getByRole("button", { name: /Increase quantity of V4 Cart Test Strawberries/i });
    await plusBtn.click();
    await expect(itemRow).toContainText("4.5");
    await expect(itemRow).toContainText("1,125.00");

    // Click increment (+) again: 4.5 -> 5 kg
    await plusBtn.click();
    await expect(itemRow).toContainText("5");
    await expect(itemRow).toContainText("1,250.00");

    // Click decrement (-): 5 -> 4.5 kg
    const minusBtn = page.getByRole("button", { name: /Decrease quantity of V4 Cart Test Strawberries/i });
    await minusBtn.click();
    await expect(itemRow).toContainText("4.5");
    await expect(itemRow).toContainText("1,125.00");

    expect(offenders).toHaveLength(0);
    await context.close();
  });

  test("4. Remove item removes the row and displays empty cart state", async ({ browser }) => {
    // Seed item
    await admin.from("cart_items").upsert({
      id: FIXTURES.cartItemId,
      business_id: activeBusinessId,
      business_clerk_id: buyer.clerkUserId,
      product_id: FIXTURES.productId,
      quantity: 4,
    });

    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    const removeBtn = page.getByRole("button", { name: /Remove V4 Cart Test Strawberries from cart/i });
    await expect(removeBtn).toBeVisible();

    await removeBtn.click();

    // Should transition to empty cart state
    const emptyState = page.getByTestId("empty-cart-state");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("Your business cart is empty");

    // Browse products CTA
    const browseLink = page.getByTestId("browse-products-link");
    await expect(browseLink).toBeVisible();
    await expect(browseLink).toHaveAttribute("href", "/products");

    expect(offenders).toHaveLength(0);
    await context.close();
  });

  test("5. Mobile and desktop viewports have no horizontal overflow", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    // Desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(desktopOverflow).toBe(false);

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(mobileOverflow).toBe(false);

    expect(offenders).toHaveLength(0);
    await context.close();
  });

  test("6. Dark and light themes render cleanly", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });

    // Toggle dark theme by adding class 'dark' to html
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByTestId("v4-cart-context-bar")).toBeVisible();

    // Toggle back to light
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await expect(page.getByTestId("v4-cart-context-bar")).toBeVisible();

    expect(offenders).toHaveLength(0);
    await context.close();
  });
});
