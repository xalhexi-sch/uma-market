// =============================================================================
// UMA Market — V4 Checkout Convergence Browser Verification
//
// Verifies a business buyer on the canonical /checkout surface only ever
// navigates to canonical V4 routes, never into the retired /business/* shell:
// 1. Desktop header: cart + dashboard links target /cart and /dashboard.
// 2. Mobile menu: cart + dashboard links target /cart and /dashboard.
// 3. "Back to Cart" targets /cart and lands there.
//
// The legacy (dashboard) sidebar/mobile-nav are not exercised here: for a
// business user every route that renders them (/business/*) is redirected by
// next.config.ts, so they are unreachable at runtime.
//
// Checkout success, confirmation, concurrency and legacy-URL redirects are
// covered by v4-pdp-add-to-cart, e2e-005-checkout-race and v4-legacy-redirects.
// =============================================================================

import { expect, test, type Browser, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authenticatedContext,
  provisionProduct,
  resolvePersona,
  serviceClient,
  upsertTestProfile,
  type Persona,
} from "./harness";

const FIXTURES = {
  fallbackBusinessId: "d4000009-0000-4000-8000-000000000010",
  fallbackMemberId:   "d4000009-0000-4000-8000-000000000020",
  productId:          "d4000009-0000-4000-8000-000000000030",
  cartItemId:         "d4000009-0000-4000-8000-000000000040",
};

let admin: SupabaseClient;
let buyer: Persona;
let farmer: Persona;
let activeBusinessId: string;

test.beforeAll(async () => {
  admin = serviceClient();
  buyer = await resolvePersona("business");
  farmer = await resolvePersona("farmer");

  await upsertTestProfile(admin, buyer.clerkUserId, "business", "PDP Buyer");
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "Benguet Harvest Farm");

  const { data: member } = await admin
    .from("business_members")
    .select("business_id")
    .eq("user_id", buyer.clerkUserId)
    .eq("role", "OWNER")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (member?.business_id) {
    activeBusinessId = member.business_id;
    await admin
      .from("businesses")
      .update({ can_buy: true, status: "active" })
      .eq("id", activeBusinessId);
  } else {
    activeBusinessId = FIXTURES.fallbackBusinessId;
    await admin.from("businesses").upsert({
      id: activeBusinessId,
      name: "Highland Greens Trading",
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

  await admin.from("cart_items").delete().eq("business_id", activeBusinessId);

  await provisionProduct(admin, {
    id: FIXTURES.productId,
    farmerClerkId: farmer.clerkUserId,
    name: "V4 Convergence Test Carrots",
    pricePerUnit: 80,
    quantity: 50,
    minOrderQuantity: 1,
  });
});

test.beforeEach(async () => {
  await admin.from("cart_items").upsert({
    id: FIXTURES.cartItemId,
    business_id: activeBusinessId,
    business_clerk_id: buyer.clerkUserId,
    product_id: FIXTURES.productId,
    quantity: 3,
  });
});

test.afterAll(async () => {
  if (activeBusinessId) {
    await admin.from("cart_items").delete().eq("business_id", activeBusinessId);
  }
  await admin.from("products").delete().eq("id", FIXTURES.productId);
});

async function openCheckout(browser: Browser, viewport: { width: number; height: number }) {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("v4-checkout-form")).toBeVisible();
  return { context, page };
}

async function expectNoLegacyLinks(page: Page) {
  await expect(page.locator('a[href^="/business"]')).toHaveCount(0);
}

test.describe("V4 checkout convergence — navigation", () => {
  test("1. Desktop header links from /checkout target canonical V4 routes", async ({ browser }) => {
    const { context, page } = await openCheckout(browser, { width: 1280, height: 900 });

    const cartLink = page.getByTitle("View Shopping Cart");
    await expect(cartLink).toHaveAttribute("href", "/cart");
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("href", "/dashboard");
    await expectNoLegacyLinks(page);

    await cartLink.click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId(`v4-cart-item-${FIXTURES.cartItemId}`)).toBeVisible();

    await context.close();
  });

  test("2. Mobile menu links from /checkout target canonical V4 routes", async ({ browser }) => {
    const { context, page } = await openCheckout(browser, { width: 390, height: 844 });

    await page.getByRole("button", { name: "Open menu" }).click();
    const viewCart = page.getByRole("link", { name: "View Cart", exact: true });
    await expect(viewCart).toBeVisible();
    await expect(viewCart).toHaveAttribute("href", "/cart");
    await expect(page.getByRole("link", { name: "Go to Dashboard" })).toHaveAttribute("href", "/dashboard");
    await expectNoLegacyLinks(page);

    await viewCart.click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId(`v4-cart-item-${FIXTURES.cartItemId}`)).toBeVisible();

    await context.close();
  });

  test("3. Checkout 'Back to Cart' targets /cart and lands there", async ({ browser }) => {
    const { context, page } = await openCheckout(browser, { width: 1280, height: 900 });

    const backLink = page.getByRole("link", { name: /Back to Cart/i }).first();
    await expect(backLink).toHaveAttribute("href", "/cart");
    await expectNoLegacyLinks(page);

    await backLink.click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId(`v4-cart-item-${FIXTURES.cartItemId}`)).toBeVisible();

    await context.close();
  });
});
