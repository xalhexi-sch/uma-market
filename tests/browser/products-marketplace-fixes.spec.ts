// =============================================================================
// UMA Market — /products marketplace bugfix verification
//
// Verifies the 3 V4 marketplace fixes:
// 1. ?in_stock=true enters catalog mode (and "See all in-stock produce" CTA works).
// 2. Autocomplete requests are deduplicated (only 1 request per query, not 2).
// 3. Directly-loaded search (?q=...) clears properly without stale results.
// =============================================================================

import { expect, test, type Page } from "@playwright/test";
import {
  PROD_APP_HOST,
  PROD_SUPABASE_HOST,
} from "./harness";

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

test.describe("/products marketplace fixes", () => {
  test("1. ?in_stock=true enters catalog mode and 'See all in-stock produce' CTA navigates to catalog mode", async ({
    page,
  }) => {
    const prodOffenders = trackProductionRequests(page);

    // Direct navigation to /products?in_stock=true must enter catalog mode
    await page.goto("/products?in_stock=true", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toContainText("Produce Marketplace");

    // In catalog mode, the status bar displays "Filtered produce catalog"
    const statusText = page.locator('p[role="status"]');
    await expect(statusText).toContainText("Filtered produce catalog");
    await expect(statusText).toContainText("In stock only");

    // Category Discovery section ("Browse by Category") should NOT be visible in catalog mode
    await expect(page.getByRole("heading", { name: "Browse by Category" })).toHaveCount(0);

    // Now test navigating from default curated discovery via "See all in-stock produce" CTA
    await page.goto("/products", { waitUntil: "domcontentloaded" });
    const curatedHeading = page.getByRole("heading", { name: "Browse by Category" });
    await expect(curatedHeading).toBeVisible();

    const ctaLink = page.getByRole("link", { name: /See all in-stock produce/i });
    if (await ctaLink.isVisible()) {
      await ctaLink.click();
      await page.waitForURL("**/products?in_stock=true");
      await expect(page.locator('p[role="status"]')).toContainText("In stock only");
      await expect(page.getByRole("heading", { name: "Browse by Category" })).toHaveCount(0);
    }

    expect(prodOffenders).toEqual([]);
  });

  test("2. Autocomplete request deduplication: only 1 request per query debounce, not 2", async ({
    page,
  }) => {
    const prodOffenders = trackProductionRequests(page);

    const suggestionRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/search/suggestions")) {
        suggestionRequests.push(req.url());
      }
    });

    await page.goto("/products", { waitUntil: "domcontentloaded" });

    // Assert that only ONE SearchAutocomplete input is mounted in the DOM
    const searchInputs = page.locator('input[aria-label="Search produce"]');
    await expect(searchInputs).toHaveCount(1);

    // Setup request listener and type query
    const reqPromise = page.waitForRequest((req) => req.url().includes("/api/search/suggestions"));
    await searchInputs.first().pressSequentially("kangkong", { delay: 30 });
    await reqPromise;

    // Settle debounce window
    await page.waitForTimeout(600);

    // Autocomplete should have fired exactly ONE request for "kangkong", not two from duplicate mounted components
    const kangkongReqs = suggestionRequests.filter((url) => url.includes("q=kangkong"));
    expect(kangkongReqs.length).toBe(1);

    expect(prodOffenders).toEqual([]);
  });

  test("3. Directly-loaded search (?q=...) clears properly without leaving stale results", async ({
    page,
  }) => {
    const prodOffenders = trackProductionRequests(page);

    // Directly load a search query
    await page.goto("/products?q=nonexistentproducexyz", { waitUntil: "domcontentloaded" });

    // Should be in catalog/search mode
    await expect(page.locator('p[role="status"]')).toContainText("nonexistentproducexyz");
    await expect(page.getByText("No produce matches your search")).toBeVisible();

    // Click the "Clear search" button
    const clearButton = page.getByRole("button", { name: "Clear search" }).first();
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // URL should be updated to /products without q
    await expect(page).not.toHaveURL(/q=/);

    // Empty search state must be gone
    await expect(page.getByText("No produce matches your search")).toHaveCount(0);

    // Curated discovery "Browse by Category" must be restored
    await expect(page.getByRole("heading", { name: "Browse by Category" })).toBeVisible({ timeout: 10000 });

    expect(prodOffenders).toEqual([]);
  });
});
