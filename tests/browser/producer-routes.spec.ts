// =============================================================================
// UMA Market — V4 Producer Routes & Legacy Compatibility Redirect Verification
//
// Verifies:
// 1. Legacy /farmers/[id] redirects to /producers/[id] via 307.
// 2. Homepage (/) contains no legacy /farmers/[id] links.
// 3. Products marketplace (/products) contains no legacy /farmers/[id] links.
// 4. Product detail page (/products/[id]) contains no legacy /farmers/[id] links
//    and uses routes.producer (i.e. /producers/[id]) for all producer profile links.
// =============================================================================

import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  provisionProduct,
  resolvePersona,
  serviceClient,
  upsertTestProfile,
  type Persona,
} from "./harness";

const pdpId = (n: number) => `c0000007-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const TEST_PRODUCT_ID = pdpId(1);

let admin: SupabaseClient;
let farmer: Persona;

test.beforeAll(async () => {
  admin = serviceClient();
  farmer = await resolvePersona("farmer");
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "Route Test Producer");

  await provisionProduct(admin, {
    id: TEST_PRODUCT_ID,
    farmerClerkId: farmer.clerkUserId,
    name: "Route Test Produce",
    pricePerUnit: 50,
    quantity: 10,
    minOrderQuantity: 1,
  });
});

test.describe("V4 Producer Routes & Migration Redirects", () => {
  test("1. Legacy /farmers/:id redirects to /producers/:id via 307", async ({
    request,
  }) => {
    const testId = "farmer_legacy_test_123";
    const response = await request.get(`/farmers/${testId}`, {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    const location = response.headers()["location"];
    expect(location).toBe(`/producers/${testId}`);
  });

  test("2. Homepage (/) contains no /farmers/ links", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Ensure page loaded
    await expect(page.locator("body")).toBeVisible();

    // Find any anchor tags with href containing /farmers/
    const legacyLinks = page.locator('a[href*="/farmers/"]');
    const legacyCount = await legacyLinks.count();
    expect(legacyCount).toBe(0);

    // If producer cards are rendered, check that their links target /producers/
    const producerLinks = page.locator('a[href*="/producers/"]');
    const producerCount = await producerLinks.count();
    // Producer links should exist if producers are displayed
    if (producerCount > 0) {
      const firstHref = await producerLinks.first().getAttribute("href");
      expect(firstHref).toMatch(/^\/producers\//);
    }
  });

  test("3. Products marketplace (/products) contains no /farmers/ links", async ({
    page,
  }) => {
    await page.goto("/products", { waitUntil: "domcontentloaded" });

    await expect(page.locator("body")).toBeVisible();

    const legacyLinks = page.locator('a[href*="/farmers/"]');
    const legacyCount = await legacyLinks.count();
    expect(legacyCount).toBe(0);

    // If product cards are present with producer provenance, they link to /producers/
    const producerLinks = page.locator('a[href*="/producers/"]');
    const producerCount = await producerLinks.count();
    if (producerCount > 0) {
      const firstHref = await producerLinks.first().getAttribute("href");
      expect(firstHref).toMatch(/^\/producers\//);
    }
  });

  test("4. Product detail page (/products/[id]) uses /producers/[id] and has no /farmers/ links", async ({
    page,
  }) => {
    await page.goto(`/products/${TEST_PRODUCT_ID}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.getByRole("heading", { level: 1, name: "Route Test Produce" }),
    ).toBeVisible();

    // Verify no legacy /farmers/ links exist anywhere on the PDP
    const legacyLinks = page.locator('a[href*="/farmers/"]');
    const legacyCount = await legacyLinks.count();
    expect(legacyCount).toBe(0);

    // Check "View producer profile" link
    const profileLink = page.getByRole("link", { name: "View producer profile" });
    if (await profileLink.isVisible()) {
      const href = await profileLink.getAttribute("href");
      expect(href).toBe(`/producers/${farmer.clerkUserId}`);
    }

    // Check "Sold by" producer link
    const soldByLink = page.locator('a[href*="/producers/"]').first();
    await expect(soldByLink).toBeVisible();
    const soldByHref = await soldByLink.getAttribute("href");
    expect(soldByHref).toBe(`/producers/${farmer.clerkUserId}`);
  });
});
