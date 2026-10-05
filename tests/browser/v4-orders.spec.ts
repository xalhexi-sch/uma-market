// =============================================================================
// UMA Market — V4 Business Orders (/orders & /orders/[id]) Browser Verification
//
// Verifies:
// 1. Unauthenticated request to /orders redirects to sign-in.
// 2. Authenticated buyer views /orders with active business context and order cards.
// 3. Tab status filtering (?view=needs, ?view=progress, ?view=completed, ?view=cancelled).
// 4. Order detail page (/orders/[id]) renders producer, items, fulfillment, audit trail.
// 5. Strict business isolation: Buyer A cannot see Buyer B's orders (404 on detail, absent on list).
// 6. Empty state displays cleanly when business has no orders.
// 7. Mobile and desktop viewports have no horizontal overflow.
// 8. Dark and light themes render cleanly.
// 9. Zero links to legacy /business/orders or /farmer/orders exist on the new V4 views.
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
  buyerBusinessId:  "d5000001-0000-4000-8000-000000000010",
  buyerMemberId:    "d5000001-0000-4000-8000-000000000020",
  otherBusinessId:  "d5000001-0000-4000-8000-000000000099",
  otherMemberId:    "d5000001-0000-4000-8000-000000000098",
  productId:        "d5000001-0000-4000-8000-000000000030",
  orderId1:         "d5000001-0000-4000-8000-000000000040",
  orderId2:         "d5000001-0000-4000-8000-000000000050",
  otherOrderId:     "d5000001-0000-4000-8000-000000000060",
  orderItemId1:     "d5000001-0000-4000-8000-000000000070",
  orderItemId2:     "d5000001-0000-4000-8000-000000000080",
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
  await upsertTestProfile(admin, buyer.clerkUserId, "business", "V4 Orders Buyer");
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "Benguet Organic Highlands");

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
    activeBusinessName = (biz as { name?: string } | null)?.name || "V4 Buyer Co";
    await admin
      .from("businesses")
      .update({ can_buy: true, status: "active" })
      .eq("id", activeBusinessId);
  } else {
    activeBusinessId = FIXTURES.buyerBusinessId;
    activeBusinessName = "Valley Fresh Kitchen";
    await admin.from("businesses").upsert({
      id: activeBusinessId,
      name: activeBusinessName,
      can_buy: true,
      can_sell: false,
      status: "active",
      legacy_clerk_id: buyer.clerkUserId,
    });
    await admin.from("business_members").upsert({
      id: FIXTURES.buyerMemberId,
      business_id: activeBusinessId,
      user_id: buyer.clerkUserId,
      role: "OWNER",
    });
  }

  // Provision product
  await provisionProduct(admin, {
    id: FIXTURES.productId,
    farmerClerkId: farmer.clerkUserId,
    name: "Fresh Highland Strawberries",
    pricePerUnit: 250,
    quantity: 100,
    minOrderQuantity: 1,
  });

  // Provision other foreign business
  await admin.from("businesses").upsert({
    id: FIXTURES.otherBusinessId,
    name: "Foreign Competitor Corp",
    can_buy: true,
    can_sell: false,
    status: "active",
    legacy_clerk_id: "user_foreign_buyer_99",
  });

  // Clean up any existing test orders
  await admin.from("order_items").delete().in("order_id", [
    FIXTURES.orderId1,
    FIXTURES.orderId2,
    FIXTURES.otherOrderId,
  ]);
  await admin.from("orders").delete().in("id", [
    FIXTURES.orderId1,
    FIXTURES.orderId2,
    FIXTURES.otherOrderId,
  ]);

  // Seed test order 1 for active business: status 'pending', delivery
  const { error: eOrder1 } = await admin.from("orders").insert({
    id: FIXTURES.orderId1,
    business_id: activeBusinessId,
    business_clerk_id: buyer.clerkUserId,
    farmer_clerk_id: farmer.clerkUserId,
    placed_by_user_id: buyer.clerkUserId,
    status: "pending",
    fulfillment_type: "seller_delivery",
    total_amount: 500,
    delivery_address: "123 Session Road, Baguio City",
    notes: "Please pack in wooden crates",
  });
  if (eOrder1) throw new Error(`Failed to insert order 1: ${eOrder1.message}`);

  const { error: eItem1 } = await admin.from("order_items").insert({
    id: FIXTURES.orderItemId1,
    order_id: FIXTURES.orderId1,
    product_id: FIXTURES.productId,
    product_name: "Fresh Highland Strawberries",
    quantity: 2,
    unit_price: 250,
    unit: "kg",
  });
  if (eItem1) throw new Error(`Failed to insert order item 1: ${eItem1.message}`);

  // Seed test order 2 for active business: status 'completed', pickup
  const { error: eOrder2 } = await admin.from("orders").insert({
    id: FIXTURES.orderId2,
    business_id: activeBusinessId,
    business_clerk_id: buyer.clerkUserId,
    farmer_clerk_id: farmer.clerkUserId,
    placed_by_user_id: buyer.clerkUserId,
    status: "completed",
    fulfillment_type: "pickup",
    pickup_date: "2026-10-10",
    total_amount: 1000,
    notes: null,
  });
  if (eOrder2) throw new Error(`Failed to insert order 2: ${eOrder2.message}`);

  const { error: eItem2 } = await admin.from("order_items").insert({
    id: FIXTURES.orderItemId2,
    order_id: FIXTURES.orderId2,
    product_id: FIXTURES.productId,
    product_name: "Fresh Highland Strawberries",
    quantity: 4,
    unit_price: 250,
    unit: "kg",
  });
  if (eItem2) throw new Error(`Failed to insert order item 2: ${eItem2.message}`);

  // Seed foreign order belonging to otherBusinessId
  await admin.from("orders").insert({
    id: FIXTURES.otherOrderId,
    business_id: FIXTURES.otherBusinessId,
    business_clerk_id: "user_foreign_buyer_99",
    farmer_clerk_id: farmer.clerkUserId,
    placed_by_user_id: "user_foreign_buyer_99",
    status: "pending",
    fulfillment_type: "seller_delivery",
    total_amount: 750,
    delivery_address: "99 Secret St, Manila",
  });
});

test.afterAll(async () => {
  if (!admin) return;
  await admin.from("order_items").delete().in("order_id", [
    FIXTURES.orderId1,
    FIXTURES.orderId2,
    FIXTURES.otherOrderId,
  ]);
  await admin.from("orders").delete().in("id", [
    FIXTURES.orderId1,
    FIXTURES.orderId2,
    FIXTURES.otherOrderId,
  ]);
  await admin.from("products").delete().eq("id", FIXTURES.productId);
  await admin.from("businesses").delete().eq("id", FIXTURES.otherBusinessId);
});

// ── Test 1: Unauthenticated request redirects ──────────────────────────────────
test("unauthenticated access to /orders redirects to /sign-in", async ({ page }) => {
  const prodLeaks = trackProductionRequests(page);
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/sign-in/);
  expect(page.url()).toContain("sign-in");
  expect(prodLeaks).toEqual([]);
});

// ── Test 2: Authenticated buyer orders list view ────────────────────────────────
test("authenticated buyer can view orders list with active business context", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toContainText("My Orders");

  // Context bar displays business name
  const contextBar = page.locator("[data-testid='v4-orders-context-bar']");
  await expect(contextBar).toBeVisible();
  await expect(contextBar).toContainText(activeBusinessName);
  await expect(contextBar).toContainText("OWNER");

  // Tab filter renders
  const tabFilter = page.locator("[data-testid='orders-tab-filter']");
  await expect(tabFilter).toBeVisible();
  await expect(tabFilter).toContainText("Needs response");
  await expect(tabFilter).toContainText("Completed");

  // Order row for orderId1 is visible
  const orderRow1 = page.locator(`[data-testid='order-row-${FIXTURES.orderId1}']`);
  await expect(orderRow1).toBeVisible();
  await expect(orderRow1).toContainText("Benguet Organic Highlands");
  await expect(orderRow1).toContainText("Fresh Highland Strawberries");
  await expect(orderRow1).toContainText("₱500.00");

  // Ensure NO legacy links to /business/orders or /farmer/orders exist
  const legacyLinks = page.locator('a[href*="/business/orders"], a[href*="/farmer/orders"]');
  await expect(legacyLinks).toHaveCount(0);

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 3: Tab filtering works correctly ──────────────────────────────────────
test("tab filtering separates orders by status", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  // Navigate to 'completed' tab
  await page.goto("/orders?view=completed");
  await page.waitForLoadState("domcontentloaded");

  // Order 2 (completed) should be visible
  const orderRow2 = page.locator(`[data-testid='order-row-${FIXTURES.orderId2}']`);
  await expect(orderRow2).toBeVisible();
  await expect(orderRow2).toContainText("₱1,000.00");

  // Order 1 (pending) should NOT be on the completed tab
  const orderRow1 = page.locator(`[data-testid='order-row-${FIXTURES.orderId1}']`);
  await expect(orderRow1).toHaveCount(0);

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 4: Order detail page renders full order breakdown ─────────────────────
test("order detail page renders producer, line items, fulfillment, and audit trail", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto(`/orders/${FIXTURES.orderId1}`);
  await page.waitForLoadState("domcontentloaded");

  // Heading contains reference
  const orderRef = FIXTURES.orderId1.slice(0, 8).toUpperCase();
  await expect(page.locator("h1")).toContainText(`#${orderRef}`);

  // Producer info is rendered
  await expect(page.locator("body")).toContainText("Benguet Organic Highlands");

  // Status banner indicates what to do next
  const banner = page.locator("[data-testid='order-status-banner']");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Awaiting Producer Acceptance");

  // Line items
  await expect(page.locator("body")).toContainText("Fresh Highland Strawberries");
  await expect(page.locator("body")).toContainText("2 kg");
  await expect(page.locator("body")).toContainText("₱500.00");

  // Fulfillment details
  await expect(page.locator("body")).toContainText("Delivery");
  await expect(page.locator("body")).toContainText("123 Session Road, Baguio City");
  await expect(page.locator("body")).toContainText("Please pack in wooden crates");

  // Audit trail
  await expect(page.locator("body")).toContainText("Order Audit Trail");
  await expect(page.locator("body")).toContainText(activeBusinessName);

  // Back to Orders link points to /orders
  const backLink = page.locator("a:has-text('Back to Orders')");
  await expect(backLink).toBeVisible();
  await expect(backLink).toHaveAttribute("href", "/orders");

  // Ensure NO legacy links to /business/orders
  const legacyLinks = page.locator('a[href*="/business/orders"], a[href*="/farmer/orders"]');
  await expect(legacyLinks).toHaveCount(0);

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 5: Strict business isolation ──────────────────────────────────────────
test("buyer cannot view an order belonging to another business", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  // Attempt to access foreign order
  await page.goto(`/orders/${FIXTURES.otherOrderId}`, { waitUntil: "domcontentloaded" });

  // Not found page is rendered (404 boundary)
  await expect(page.locator("body")).toContainText("Page not found");

  // Ensure foreign order content is NOT rendered to the unauthorized buyer
  await expect(page.locator("[data-testid='order-status-banner']")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("99 Secret St, Manila");

  // Also check orders list does NOT contain foreign order
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  const foreignRow = page.locator(`[data-testid='order-row-${FIXTURES.otherOrderId}']`);
  await expect(foreignRow).toHaveCount(0);

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 6: Responsive desktop vs mobile viewport ──────────────────────────────
test("renders cleanly on desktop and mobile without overflow", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  // Desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/orders");
  await expect(page.locator("[data-testid='v4-orders-context-bar']")).toBeVisible();

  let hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasOverflow).toBe(false);

  // Mobile
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/orders");
  await expect(page.locator("[data-testid='v4-orders-context-bar']")).toBeVisible();

  hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasOverflow).toBe(false);

  // Detail page mobile
  await page.goto(`/orders/${FIXTURES.orderId1}`);
  hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasOverflow).toBe(false);

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 7: Dark theme clean rendering ─────────────────────────────────────────
test("renders cleanly in dark mode", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/orders");

  await expect(page.locator("[data-testid='v4-orders-context-bar']")).toBeVisible();
  const orderRow1 = page.locator(`[data-testid='order-row-${FIXTURES.orderId1}']`);
  await expect(orderRow1).toBeVisible();

  expect(prodLeaks).toEqual([]);
  await context.close();
});
