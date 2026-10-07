// =============================================================================
// UMA Market — Phase 8A Visual QA & Layout Harmonization Spec
//
// Renders and verifies all major screens across:
// - Viewports: Desktop (1280x900) & Mobile (375x812)
// - Color schemes: Light & Dark
// - Horizontal overflow checks: zero horizontal bleed (scrollWidth <= clientWidth)
// - Full-page screenshot capture for visual inspection: test-results/visual-qa/
// =============================================================================

import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authenticatedContext,
  cleanupProduct,
  PROD_APP_HOST,
  PROD_SUPABASE_HOST,
  provisionProduct,
  resetCart,
  resolvePersona,
  runCleanup,
  serviceClient,
  upsertTestProfile,
  type Persona,
} from "./harness";

const SHOT_DIR = "test-results/visual-qa";

const FIXTURES = {
  productId: "c000000a-0000-4000-8000-000000000001",
  businessId: "d600000a-0000-4000-8000-000000000001",
  memberId: "d600000a-0000-4000-8000-000000000002",
  conversationId: "d600000a-0000-4000-8000-000000000003",
  producerBizId: "d600000a-0000-4000-8000-000000000004",
  producerMemberId: "d600000a-0000-4000-8000-000000000005",
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
  [farmer, buyer] = await Promise.all([
    resolvePersona("farmer"),
    resolvePersona("business"),
  ]);

  // 1. Setup profiles
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "Visual QA Farms");
  await upsertTestProfile(admin, buyer.clerkUserId, "business", "Visual QA Commercial Buyer");

  // 2. Setup businesses
  await admin.from("businesses").upsert([
    {
      id: FIXTURES.businessId,
      name: "Visual QA Commercial Kitchen",
      can_buy: true,
      can_sell: true,
      status: "active",
    },
    {
      id: FIXTURES.producerBizId,
      name: "Visual QA Farm Direct",
      can_buy: false,
      can_sell: true,
      status: "active",
    },
  ]);

  await admin.from("business_members").upsert([
    {
      id: FIXTURES.memberId,
      business_id: FIXTURES.businessId,
      user_id: buyer.clerkUserId,
      role: "OWNER",
    },
    {
      id: FIXTURES.producerMemberId,
      business_id: FIXTURES.producerBizId,
      user_id: farmer.clerkUserId,
      role: "OWNER",
    },
  ]);

  // 3. Provision sample product
  await provisionProduct(admin, {
    id: FIXTURES.productId,
    farmerClerkId: farmer.clerkUserId,
    name: "Visual QA Native Tomatoes",
    pricePerUnit: 65,
    quantity: 120,
    minOrderQuantity: 10,
  });

  // 4. Provision cart item for buyer
  await admin.from("cart_items").upsert({
    user_id: buyer.clerkUserId,
    product_id: FIXTURES.productId,
    quantity: 20,
  });

  // 5. Setup relationship conversation for messages
  const canonA = FIXTURES.businessId < FIXTURES.producerBizId ? FIXTURES.businessId : FIXTURES.producerBizId;
  const canonB = FIXTURES.businessId < FIXTURES.producerBizId ? FIXTURES.producerBizId : FIXTURES.businessId;

  await admin.from("conversations").upsert({
    id: FIXTURES.conversationId,
    business_a_id: canonA,
    business_b_id: canonB,
  });

  await admin.from("messages").upsert({
    conversation_id: FIXTURES.conversationId,
    sender_clerk_id: farmer.clerkUserId,
    sender_business_id: FIXTURES.producerBizId,
    content: "Visual QA: Fresh harvest is scheduled for Friday morning.",
    status: "sent",
  });
});

test.afterAll(async () => {
  await runCleanup([
    { label: "reset buyer cart", run: async () => resetCart(admin, buyer.clerkUserId) },
    { label: "remove sample product", run: async () => cleanupProduct(admin, FIXTURES.productId) },
    { label: "cleanup conversation", run: async () => { await admin.from("conversations").delete().eq("id", FIXTURES.conversationId); } },
    { label: "cleanup buyer members", run: async () => { await admin.from("business_members").delete().eq("business_id", FIXTURES.businessId); } },
    { label: "cleanup producer members", run: async () => { await admin.from("business_members").delete().eq("business_id", FIXTURES.producerBizId); } },
    { label: "cleanup buyer business", run: async () => { await admin.from("businesses").delete().eq("id", FIXTURES.businessId); } },
    { label: "cleanup producer business", run: async () => { await admin.from("businesses").delete().eq("id", FIXTURES.producerBizId); } },
  ]);
});

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 375, height: 812 },
];

const SCHEMES = ["light", "dark"] as const;

// ── 1. PUBLIC MARKETPLACE PAGES ──────────────────────────────────────────────
const PUBLIC_PAGES = [
  { name: "home", path: "/" },
  { name: "products", path: "/products" },
  { name: "product-detail", path: `/products/${FIXTURES.productId}` },
  { name: "producers", path: "/producers" },
  { name: "producer-profile", path: "/producers/__PRODUCER__" },
];

for (const { name, path } of PUBLIC_PAGES) {
  for (const viewport of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      test(`public: ${name} (${viewport.name}, ${scheme})`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: scheme,
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const offenders = trackProductionRequests(page);

        const targetPath = name === "producer-profile" ? `/producers/${farmer.clerkUserId}` : path;
        await page.goto(targetPath, { waitUntil: "domcontentloaded" });

        // Verify page rendered
        await expect(page.locator("body")).toBeVisible();

        // Check zero horizontal overflow
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1);

        // Capture screenshot
        await page.screenshot({
          path: `${SHOT_DIR}/public-${name}-${viewport.name}-${scheme}.png`,
          fullPage: true,
        });

        expect(offenders).toEqual([]);
        await context.close();
      });
    }
  }
}

// ── 2. BUYER & WORKSPACE PAGES ──────────────────────────────────────────────
const AUTH_PAGES = [
  { name: "cart", path: "/cart" },
  { name: "checkout", path: "/checkout" },
  { name: "orders", path: "/orders" },
  { name: "messages", path: "/messages" },
  { name: "dashboard", path: "/dashboard" },
  { name: "members", path: "/dashboard/members" },
  { name: "settings", path: "/dashboard/settings" },
];

for (const { name, path } of AUTH_PAGES) {
  for (const viewport of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      test(`auth: ${name} (${viewport.name}, ${scheme})`, async ({ browser }) => {
        const { context } = await authenticatedContext(browser, buyer);
        await context.addCookies([
          { name: "uma_active_business_id", value: FIXTURES.businessId, domain: "localhost", path: "/" },
          { name: "uma_active_business", value: FIXTURES.businessId, domain: "localhost", path: "/" },
        ]);

        const page = await context.newPage();
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        const offenders = trackProductionRequests(page);

        await page.goto(path, { waitUntil: "domcontentloaded" });

        // Verify page rendered
        await expect(page.locator("body")).toBeVisible();

        // Check zero horizontal overflow
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1);

        // Capture screenshot
        await page.screenshot({
          path: `${SHOT_DIR}/auth-${name}-${viewport.name}-${scheme}.png`,
          fullPage: true,
        });

        expect(offenders).toEqual([]);
        await context.close();
      });
    }
  }
}
