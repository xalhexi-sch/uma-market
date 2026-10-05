// =============================================================================
// UMA Market — /products/[id] product detail page browser checks
//
// Runs against the isolated security-test environment (see harness.ts). Covers:
// available / out-of-stock / not-found states, desktop + mobile, light + dark,
// keyboard focus, reduced motion and the business-buyer add-to-cart path.
// =============================================================================

import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROD_APP_HOST,
  PROD_SUPABASE_HOST,
  authenticatedContext,
  cleanupProduct,
  provisionProduct,
  resetCart,
  resolvePersona,
  runCleanup,
  serviceClient,
  upsertTestProfile,
  type Persona,
} from "./harness";

const SHOT_DIR = process.env.UMA_PDP_SHOT_DIR ?? "test-results/pdp";

/** Deterministic fixture ids local to this spec (kept out of the shared harness). */
const pdpId = (n: number) => `c0000007-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const IDS = {
  available: pdpId(1),
  soldOut: pdpId(2),
  sibling: pdpId(3),
  missing: pdpId(99),
};

let admin: SupabaseClient;
let farmer: Persona;
let buyer: Persona;

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
  [farmer, buyer] = await Promise.all([resolvePersona("farmer"), resolvePersona("business")]);
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "PDP Farmer");
  await upsertTestProfile(admin, buyer.clerkUserId, "business", "PDP Buyer");

  await provisionProduct(admin, {
    id: IDS.available,
    farmerClerkId: farmer.clerkUserId,
    name: "PDP Kangkong Available",
    pricePerUnit: 55,
    quantity: 8,
    minOrderQuantity: 2,
  });
  await provisionProduct(admin, {
    id: IDS.soldOut,
    farmerClerkId: farmer.clerkUserId,
    name: "PDP Ampalaya Sold Out",
    pricePerUnit: 70,
    quantity: 0,
    minOrderQuantity: 1,
  });
  await provisionProduct(admin, {
    id: IDS.sibling,
    farmerClerkId: farmer.clerkUserId,
    name: "PDP Sitaw Sibling",
    pricePerUnit: 40,
    quantity: 50,
    minOrderQuantity: 1,
  });
});

test.afterAll(async () => {
  await runCleanup([
    { label: "reset buyer cart", run: () => resetCart(admin, buyer.clerkUserId) },
    { label: "remove PDP available", run: () => cleanupProduct(admin, IDS.available) },
    { label: "remove PDP sold out", run: () => cleanupProduct(admin, IDS.soldOut) },
    { label: "remove PDP sibling", run: () => cleanupProduct(admin, IDS.sibling) },
  ]);
});

for (const scheme of ["light", "dark"] as const) {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`available product renders (${viewport.name}, ${scheme})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: scheme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const offenders = trackProductionRequests(page);

      await page.goto(`/products/${IDS.available}`, { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { level: 1, name: "PDP Kangkong Available" })).toBeVisible();
      await expect(page.getByText("₱55.00").first()).toBeVisible();
      await expect(page.getByText(/Low stock · 8 kg available/)).toBeVisible();
      await expect(page.getByText(/Min\. order 2 kg/)).toBeVisible();
      await expect(page.getByRole("link", { name: "Sign in to order" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Message producer" })).toBeDisabled();
      await expect(page.getByRole("link", { name: "View producer profile" })).toBeVisible();
      // more-from-producer shows the sibling but never the sold-out product or itself
      await expect(page.getByRole("heading", { name: /^More from / })).toBeVisible();
      await expect(page.getByText("PDP Sitaw Sibling")).toBeVisible();
      await expect(page.getByText("PDP Ampalaya Sold Out")).toHaveCount(0);

      // No horizontal overflow
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      const bar = page.locator("div.fixed.bottom-0");
      if (viewport.name === "mobile") {
        await expect(bar).toBeVisible();
        await bar.getByRole("link", { name: "Order" }).click();
        await expect(page.locator("#order")).toBeInViewport();
      } else {
        await expect(bar).toBeHidden();
      }

      await page.screenshot({ path: `${SHOT_DIR}/available-${viewport.name}-${scheme}.png`, fullPage: true });
      expect(offenders).toEqual([]);
      await context.close();
    });
  }
}

test("out-of-stock product is clearly unavailable", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`/products/${IDS.soldOut}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "PDP Ampalaya Sold Out" })).toBeVisible();
  await expect(page.getByText("Out of stock").first()).toBeVisible();
  await expect(page.locator("div.fixed.bottom-0").getByRole("link", { name: "Order" })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/out-of-stock-mobile.png`, fullPage: true });
  await context.close();
});

test("unknown product id returns the not-found page", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/products/${IDS.missing}`, { waitUntil: "domcontentloaded" });
  // loading.tsx streams the response, so the HTTP status is already 200; assert the rendered page.
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/not-found.png` });
  await context.close();
});

test("keyboard users get a visible focus ring and reach the producer link", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`/products/${IDS.available}`, { waitUntil: "domcontentloaded" });

  const producerLink = page.getByRole("link", { name: "View producer profile" });
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await producerLink.evaluate((el) => el === document.activeElement);
  }
  expect(reached).toBe(true);
  const ring = await producerLink.evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.boxShadow} ${s.outlineStyle}`;
  });
  expect(ring).not.toMatch(/^none none$/);
  await context.close();
});

test("business buyer can pick a quantity and add to cart", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  await resetCart(admin, buyer.clerkUserId);
  await page.goto(`/products/${IDS.available}`, { waitUntil: "domcontentloaded" });

  const increase = page.getByRole("button", { name: "Increase quantity" });
  await expect(async () => {
    await increase.click();
    await expect(page.getByRole("group", { name: "Quantity in kg" })).toContainText("2.5");
  }).toPass({ timeout: 30_000 });

  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByRole("status").filter({ hasText: "added to cart" })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/buyer-added.png`, fullPage: true });
  await context.close();
});
