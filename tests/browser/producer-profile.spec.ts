// =============================================================================
// UMA Market — V4 Producer Profile (/producers/[id]) Browser Verification
//
// Verifies:
// 1. Valid producer renders with identity, avatar, badges, location, bio, and message action.
// 2. Responsive layout across desktop/mobile and light/dark modes.
// 3. Active products render with cards and link to /products/[id].
// 4. Empty product state displays clean empty UI and marketplace CTA.
// 5. Missing producer renders not-found state (404).
// 6. Zero legacy /farmers/ links exist anywhere on the page.
// 7. No horizontal overflow.
// =============================================================================

import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROD_APP_HOST,
  PROD_SUPABASE_HOST,
  provisionProduct,
  resolvePersona,
  serviceClient,
  upsertTestProfile,
  type Persona,
} from "./harness";

const prodId = (n: number) => `c0000008-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const IDS = {
  activeProduct1: prodId(1),
  activeProduct2: prodId(2),
  missingProducer: "missing-producer-id-00000000",
};

const EMPTY_PRODUCER_ID = "user_test_empty_producer_999";

let admin: SupabaseClient;
let farmerWithProducts: Persona;

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
  farmerWithProducts = await resolvePersona("farmer");

  // Set up producer with products
  await upsertTestProfile(
    admin,
    farmerWithProducts.clerkUserId,
    "farmer",
    "Agusan Valley Harvest",
  );
  await admin
    .from("profiles")
    .update({
      bio: "Sustainable lowland organic farm growing indigenous vegetables and tropical fruits.",
    })
    .eq("clerk_id", farmerWithProducts.clerkUserId);

  // Set up producer without products
  await upsertTestProfile(
    admin,
    EMPTY_PRODUCER_ID,
    "farmer",
    "Empty Valley Farm",
  );

  // Provision active products for farmerWithProducts
  await provisionProduct(admin, {
    id: IDS.activeProduct1,
    farmerClerkId: farmerWithProducts.clerkUserId,
    name: "Producer Profile Kangkong",
    pricePerUnit: 45,
    quantity: 25,
    minOrderQuantity: 5,
  });

  await provisionProduct(admin, {
    id: IDS.activeProduct2,
    farmerClerkId: farmerWithProducts.clerkUserId,
    name: "Producer Profile Calamansi",
    pricePerUnit: 60,
    quantity: 50,
    minOrderQuantity: 10,
  });
});

test.afterAll(async () => {
  if (admin) {
    await admin.from("profiles").delete().eq("clerk_id", EMPTY_PRODUCER_ID);
  }
});

test.describe("V4 Producer Profile (/producers/[id])", () => {
  const VIEWPORTS = [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 390, height: 844 },
  ] as const;

  const SCHEMES = ["light", "dark"] as const;

  for (const viewport of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      test(`producer profile renders across ${viewport.name} (${scheme})`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: scheme,
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const offenders = trackProductionRequests(page);

        await page.goto(`/producers/${farmerWithProducts.clerkUserId}`, {
          waitUntil: "domcontentloaded",
        });

        // 1. Strong producer identity
        await expect(
          page.getByRole("heading", { level: 1, name: "Agusan Valley Harvest Co" })
        ).toBeVisible();

        // City pill
        await expect(page.getByText("Butuan · Philippines")).toBeVisible();

        // Active listings count
        await expect(page.getByText(/\d+ active listings/)).toBeVisible();

        // Bio
        await expect(
          page.getByText("Sustainable lowland organic farm growing indigenous vegetables and tropical fruits.")
        ).toBeVisible();

        // Message producer action — V4 relationship messaging is live. The accessible
        // name begins with the visible label (WCAG 2.5.3 Label in Name) and adds the
        // producer as context.
        const messageBtn = page.getByRole("button", {
          name: "Message producer — Agusan Valley Harvest Co",
          exact: true,
        });
        await expect(messageBtn).toBeVisible();
        await expect(messageBtn).toBeEnabled();
        await expect(messageBtn).toHaveText("Message producer");
        await expect(
          page.getByText(
            "Direct messaging with Agusan Valley Harvest Co. Inquiries and order coordination are organized in your business inbox.",
          ),
        ).toBeVisible();
        await expect(page.getByText(/coming soon/i)).toHaveCount(0);

        // 2. Active products section & cards
        await expect(
          page.getByRole("heading", { level: 2, name: "Available Products" })
        ).toBeVisible();
        await expect(page.getByText("Producer Profile Kangkong")).toBeVisible();
        await expect(page.getByText("Producer Profile Calamansi")).toBeVisible();

        // Check that product cards link to /products/[id]
        const productLink = page.locator(`a[href="/products/${IDS.activeProduct1}"]`);
        await expect(productLink.first()).toBeVisible();

        // 3. Verified Reviews section
        await expect(
          page.getByRole("heading", { level: 2, name: "Verified Buyer Reviews" })
        ).toBeVisible();

        // 4. Ensure NO legacy /farmers/ links anywhere on page
        const legacyLinks = page.locator('a[href*="/farmers/"]');
        expect(await legacyLinks.count()).toBe(0);

        // 5. Breadcrumbs
        const breadcrumbNav = page.locator('nav[aria-label="Breadcrumb"]');
        await expect(breadcrumbNav).toBeVisible();
        await expect(breadcrumbNav.getByRole("link", { name: "Marketplace", exact: true })).toHaveAttribute("href", "/products");

        // 6. No horizontal overflow
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);

        expect(offenders).toEqual([]);
        await context.close();
      });
    }
  }

  test("empty products state renders cleanly with marketplace CTA", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await page.goto(`/producers/${EMPTY_PRODUCER_ID}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.getByRole("heading", { level: 1, name: "Empty Valley Farm Co" })
    ).toBeVisible();

    // Active listings should say 0
    await expect(page.getByText("0 active listings")).toBeVisible();

    // Empty state should be visible
    await expect(page.getByText("No produce currently listed")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Explore Marketplace" })
    ).toHaveAttribute("href", "/products");

    // Zero legacy links
    const legacyLinks = page.locator('a[href*="/farmers/"]');
    expect(await legacyLinks.count()).toBe(0);

    await context.close();
  });

  test("missing producer renders not-found state", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await page.goto(`/producers/${IDS.missingProducer}`, {
      waitUntil: "domcontentloaded",
    });

    // loading.tsx streams the response with HTTP 200; assert the rendered not-found page
    await expect(
      page.getByRole("heading", { level: 1, name: "Producer Not Found" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Explore Marketplace" })
    ).toHaveAttribute("href", "/products");

    await context.close();
  });
});
