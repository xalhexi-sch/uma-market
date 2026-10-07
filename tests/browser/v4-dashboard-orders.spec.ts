// =============================================================================
// UMA Market — V4 Seller / Producer Dashboard Orders (/dashboard/orders) Browser Verification
//
// Verifies:
// 1. Unauthenticated request to /dashboard/orders redirects to /sign-in.
// 2. Authenticated access renders active business context bar and role badge.
// 3. SELL-only business views incoming wholesale orders.
// 4. BOTH (Buy & Sell) business views incoming wholesale orders.
// 5. BUY-only business is blocked from managing sales (shows capability required state).
// 6. OWNER and STAFF roles both have access to view and manage orders.
// 7. Business isolation: active business only sees incoming orders for itself, never foreign orders.
// 8. Order status/action workflow: interactive transition (pending -> accepted -> preparing) via state machine.
// 9. Zero legacy /farmer or /business links exist anywhere on /dashboard/orders.
// 10. Mobile (375px) and desktop (1280px) viewports with no horizontal overflow.
// 11. Clean dark mode rendering.
// 12. Zero production network requests.
// =============================================================================

import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authenticatedContext,
  E2E_BASE_URL,
  PROD_APP_HOST,
  PROD_SUPABASE_HOST,
  provisionProduct,
  resolvePersona,
  serviceClient,
  upsertTestProfile,
  type Persona,
} from "./harness";
import { ACTIVE_BUSINESS_COOKIE } from "@/platform";

const FIXTURES = {
  farmerBusinessId:    "d6000001-0000-4000-8000-000000000010",
  farmerMemberOwnerId: "d6000001-0000-4000-8000-000000000020",
  buyerBusinessId:     "d6000001-0000-4000-8000-000000000030",
  buyerMemberOwnerId:  "d6000001-0000-4000-8000-000000000040",
  productId:           "d6000001-0000-4000-8000-000000000045",
  foreignProductId:    "d6000001-0000-4000-8000-000000000046",
  order1Id:            "d6000001-0000-4000-8000-000000000050",
  order1ItemId:        "d6000001-0000-4000-8000-000000000051",
  foreignOrderId:      "d6000001-0000-4000-8000-000000000060",
  foreignOrderItemId:  "d6000001-0000-4000-8000-000000000061",
};

let admin: SupabaseClient;
let buyer: Persona;
let farmer: Persona;

let buyerBusinessId: string;
let buyerMemberId: string;

let farmerBusinessId: string;
let farmerBusinessName: string;
let farmerMemberId: string;

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

  await upsertTestProfile(admin, buyer.clerkUserId, "business", "V4 Buyer Co");
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "Highland Strawberry Farms");

  // 1. Resolve or create buyer's active business (BUY-only, OWNER)
  const { data: bMember } = await admin
    .from("business_members")
    .select("id, business_id, role, businesses(id, name, can_buy, can_sell)")
    .eq("user_id", buyer.clerkUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (bMember?.business_id && bMember.businesses) {
    buyerBusinessId = bMember.business_id;
    buyerMemberId = bMember.id;
    await admin
      .from("businesses")
      .update({ can_buy: true, can_sell: false, status: "active" })
      .eq("id", buyerBusinessId);
    await admin
      .from("business_members")
      .update({ role: "OWNER" })
      .eq("id", buyerMemberId);
  } else {
    buyerBusinessId = FIXTURES.buyerBusinessId;
    buyerMemberId = FIXTURES.buyerMemberOwnerId;
    await admin.from("businesses").upsert({
      id: buyerBusinessId,
      name: "Valley Fresh Kitchen",
      can_buy: true,
      can_sell: false,
      status: "active",
      legacy_clerk_id: buyer.clerkUserId,
    });
    await admin.from("business_members").upsert({
      id: buyerMemberId,
      business_id: buyerBusinessId,
      user_id: buyer.clerkUserId,
      role: "OWNER",
    });
  }

  // 2. Resolve or create farmer's active business (SELL-only, OWNER)
  const { data: fMember } = await admin
    .from("business_members")
    .select("id, business_id, role, businesses(id, name, can_buy, can_sell)")
    .eq("user_id", farmer.clerkUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fMember?.business_id && fMember.businesses) {
    farmerBusinessId = fMember.business_id;
    farmerMemberId = fMember.id;
    const biz = Array.isArray(fMember.businesses) ? fMember.businesses[0] : fMember.businesses;
    farmerBusinessName = (biz as { name?: string } | null)?.name || "Highland Strawberry Farms";
    await admin
      .from("businesses")
      .update({ can_buy: false, can_sell: true, status: "active" })
      .eq("id", farmerBusinessId);
    await admin
      .from("business_members")
      .update({ role: "OWNER" })
      .eq("id", farmerMemberId);
  } else {
    farmerBusinessId = FIXTURES.farmerBusinessId;
    farmerMemberId = FIXTURES.farmerMemberOwnerId;
    farmerBusinessName = "Highland Strawberry Farms";
    await admin.from("businesses").upsert({
      id: farmerBusinessId,
      name: farmerBusinessName,
      can_buy: false,
      can_sell: true,
      status: "active",
      legacy_clerk_id: farmer.clerkUserId,
    });
    await admin.from("business_members").upsert({
      id: farmerMemberId,
      business_id: farmerBusinessId,
      user_id: farmer.clerkUserId,
      role: "OWNER",
    });
  }

  // 3. Ensure foreign profile and provision products
  await upsertTestProfile(admin, "user_foreign_farmer_99", "farmer", "Foreign Producer");

  await provisionProduct(admin, {
    id: FIXTURES.productId,
    farmerClerkId: farmer.clerkUserId,
    name: "Benguet Organic Strawberries",
    pricePerUnit: 300,
    quantity: 100,
    minOrderQuantity: 1,
  });

  await provisionProduct(admin, {
    id: FIXTURES.foreignProductId,
    farmerClerkId: "user_foreign_farmer_99",
    name: "Foreign Hydroponic Lettuce",
    pricePerUnit: 888.8,
    quantity: 50,
    minOrderQuantity: 1,
  });

  // 4. Clean up existing fixture orders
  await admin.from("order_items").delete().in("order_id", [
    FIXTURES.order1Id,
    FIXTURES.foreignOrderId,
  ]);
  await admin.from("orders").delete().in("id", [
    FIXTURES.order1Id,
    FIXTURES.foreignOrderId,
  ]);

  // 5. Seed test order directed to farmer's business
  const { error: eOrder1 } = await admin.from("orders").insert({
    id: FIXTURES.order1Id,
    business_id: buyerBusinessId,
    business_clerk_id: buyer.clerkUserId,
    farmer_clerk_id: farmer.clerkUserId,
    placed_by_user_id: buyer.clerkUserId,
    status: "pending",
    fulfillment_type: "seller_delivery",
    total_amount: 1500,
    delivery_address: "456 Strawberry Lane, La Trinidad",
    notes: "Please deliver before 10 AM",
  });
  if (eOrder1) throw new Error(`Failed to insert order 1: ${eOrder1.message}`);

  const { error: eItem1 } = await admin.from("order_items").insert({
    id: FIXTURES.order1ItemId,
    order_id: FIXTURES.order1Id,
    product_id: FIXTURES.productId,
    product_name: "Benguet Organic Strawberries",
    quantity: 5,
    unit_price: 300,
    unit: "kg",
  });
  if (eItem1) throw new Error(`Failed to insert order item 1: ${eItem1.message}`);

  // 6. Seed foreign order directed to another producer
  const { error: eForeign } = await admin.from("orders").insert({
    id: FIXTURES.foreignOrderId,
    business_id: buyerBusinessId,
    business_clerk_id: buyer.clerkUserId,
    farmer_clerk_id: "user_foreign_farmer_99",
    placed_by_user_id: buyer.clerkUserId,
    status: "pending",
    fulfillment_type: "pickup",
    total_amount: 8888,
  });
  if (eForeign) throw new Error(`Failed to insert foreign order: ${eForeign.message}`);

  const { error: eForeignItem } = await admin.from("order_items").insert({
    id: FIXTURES.foreignOrderItemId,
    order_id: FIXTURES.foreignOrderId,
    product_id: FIXTURES.foreignProductId,
    product_name: "Foreign Hydroponic Lettuce",
    quantity: 10,
    unit_price: 888.8,
    unit: "crate",
  });
  if (eForeignItem) throw new Error(`Failed to insert foreign order item: ${eForeignItem.message}`);
});

test.afterAll(async () => {
  if (!admin) return;
  // Cleanup test orders
  await admin.from("order_items").delete().in("order_id", [
    FIXTURES.order1Id,
    FIXTURES.foreignOrderId,
  ]);
  await admin.from("orders").delete().in("id", [
    FIXTURES.order1Id,
    FIXTURES.foreignOrderId,
  ]);
  await admin.from("products").delete().in("id", [
    FIXTURES.productId,
    FIXTURES.foreignProductId,
  ]);

  // Restore buyer business state
  if (buyerBusinessId) {
    await admin
      .from("businesses")
      .update({ can_buy: true, can_sell: false })
      .eq("id", buyerBusinessId);
  }
  if (buyerMemberId) {
    await admin
      .from("business_members")
      .update({ role: "OWNER" })
      .eq("id", buyerMemberId);
  }
  // Restore farmer business state
  if (farmerBusinessId) {
    await admin
      .from("businesses")
      .update({ can_buy: false, can_sell: true })
      .eq("id", farmerBusinessId);
  }
  if (farmerMemberId) {
    await admin
      .from("business_members")
      .update({ role: "OWNER" })
      .eq("id", farmerMemberId);
  }
});

// ── Test 1: Unauthenticated request redirects ──────────────────────────────────
test("unauthenticated access to /dashboard/orders redirects to /sign-in", async ({ page }) => {
  const prodLeaks = trackProductionRequests(page);
  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/sign-in/);
  expect(page.url()).toContain("sign-in");
  expect(prodLeaks).toEqual([]);
});

// ── Test 2: Authenticated seller access & context bar ──────────────────────────
test("authenticated seller views /dashboard/orders with context bar and role", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, farmer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toContainText("Wholesale Order Operations");

  const contextBar = page.locator("[data-testid='v4-seller-orders-context-bar']");
  await expect(contextBar).toBeVisible();
  await expect(contextBar.locator("[data-testid='business-name']")).toHaveText(farmerBusinessName);
  await expect(contextBar.locator("[data-testid='role-badge']")).toHaveText("OWNER");
  await expect(contextBar.locator("[data-testid='capability-badge']")).toHaveText("Producer");

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 3: SELL-only business views incoming orders ───────────────────────────
test("SELL-only business views incoming orders and summary stats", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, farmer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });

  const orderCard = page.locator(`[data-testid='seller-order-card-${FIXTURES.order1Id}']`);
  await expect(orderCard).toBeVisible();
  await expect(orderCard).toContainText("Benguet Organic Strawberries");
  await expect(orderCard).toContainText("1,500");
  await expect(orderCard).toContainText("Delivery");
  await expect(orderCard).toContainText("New incoming order awaiting your review");

  // Accept and Decline buttons visible for pending status
  await expect(orderCard.locator("[data-testid='order-action-accept']")).toBeVisible();
  await expect(orderCard.locator("[data-testid='order-action-decline']")).toBeVisible();

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 4: BOTH (Buy & Sell) business views incoming orders ───────────────────
test("BOTH (Buy & Sell) business views incoming orders workspace", async ({ browser }) => {
  // Update farmer business to BOTH
  await admin
    .from("businesses")
    .update({ can_buy: true, can_sell: true })
    .eq("id", farmerBusinessId);

  const { context } = await authenticatedContext(browser, farmer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-testid='capability-badge']")).toHaveText("Buy & Sell");
  await expect(page.locator(`[data-testid='seller-order-card-${FIXTURES.order1Id}']`)).toBeVisible();

  expect(prodLeaks).toEqual([]);
  await context.close();

  // Revert back to SELL-only
  await admin
    .from("businesses")
    .update({ can_buy: false, can_sell: true })
    .eq("id", farmerBusinessId);
});

// ── Test 5: BUY-only business is blocked from incoming sales ───────────────────
test("BUY-only business cannot manage incoming sales and is guided to buyer orders", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });

  const capabilityNotice = page.locator("[data-testid='selling-capability-required']");
  await expect(capabilityNotice).toBeVisible();
  await expect(capabilityNotice).toContainText("Selling Capability Required");
  await expect(capabilityNotice).toContainText("is currently configured as a Buyer Business");

  // Guide button leads to buyer orders /orders
  const buyerOrdersLink = capabilityNotice.locator("a[href='/orders']");
  await expect(buyerOrdersLink).toBeVisible();
  await expect(buyerOrdersLink).toHaveText("View My Buyer Orders");

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 6: STAFF member access and operations ─────────────────────────────────
test("STAFF member can access /dashboard/orders with operational permissions", async ({ browser }) => {
  // Set farmer member to STAFF
  await admin
    .from("business_members")
    .update({ role: "STAFF" })
    .eq("id", farmerMemberId);

  const { context } = await authenticatedContext(browser, farmer);
  await context.addCookies([{ name: ACTIVE_BUSINESS_COOKIE, value: farmerBusinessId, url: E2E_BASE_URL }]);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-testid='role-badge']")).toHaveText("STAFF");
  const orderCard = page.locator(`[data-testid='seller-order-card-${FIXTURES.order1Id}']`);
  await expect(orderCard).toBeVisible();
  await expect(orderCard.locator("[data-testid='order-action-accept']")).toBeVisible();

  expect(prodLeaks).toEqual([]);
  await context.close();

  // Restore to OWNER
  await admin
    .from("business_members")
    .update({ role: "OWNER" })
    .eq("id", farmerMemberId);
});

// ── Test 7: Business isolation ─────────────────────────────────────────────────
test("business isolation: active seller never sees foreign orders", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, farmer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard/orders?tab=all", { waitUntil: "domcontentloaded" });

  // Farmer's own order is visible
  await expect(page.locator(`[data-testid='seller-order-card-${FIXTURES.order1Id}']`)).toBeVisible();

  // Foreign order is strictly NOT in the DOM
  await expect(page.locator(`[data-testid='seller-order-card-${FIXTURES.foreignOrderId}']`)).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Foreign Hydroponic Lettuce");
  await expect(page.locator("body")).not.toContainText("₱8,888");

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 8: Order state transitions via state machine ──────────────────────────
test("advances order status through state machine: pending -> accepted -> preparing", async ({ browser }) => {
  // Ensure order 1 is pending
  await admin
    .from("orders")
    .update({ status: "pending" })
    .eq("id", FIXTURES.order1Id);

  const { context } = await authenticatedContext(browser, farmer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard/orders?tab=all", { waitUntil: "domcontentloaded" });

  const orderCard = page.locator(`[data-testid='seller-order-card-${FIXTURES.order1Id}']`);
  await expect(orderCard).toBeVisible();
  await expect(orderCard.locator("[data-testid='order-action-accept']")).toBeVisible();

  // Step 1: Click Accept Order
  await orderCard.locator("[data-testid='order-action-accept']").click();

  // Await status update to "accepted"
  await expect(orderCard.locator("[data-testid='seller-order-status-badge']")).toHaveText("Accepted");
  await expect(orderCard).toContainText("Start Preparing");

  // Verify in database that RPC changed status to accepted
  const { data: dbOrderAfterAccept } = await admin
    .from("orders")
    .select("status")
    .eq("id", FIXTURES.order1Id)
    .single();
  expect(dbOrderAfterAccept?.status).toBe("accepted");

  // Step 2: Click Start Preparing
  await orderCard.locator("[data-testid='order-action-preparing']").click();

  // Await status update to "preparing"
  await expect(orderCard.locator("[data-testid='seller-order-status-badge']")).toHaveText("Preparing");
  await expect(orderCard).toContainText("Mark Ready for Delivery");

  const { data: dbOrderAfterPrep } = await admin
    .from("orders")
    .select("status")
    .eq("id", FIXTURES.order1Id)
    .single();
  expect(dbOrderAfterPrep?.status).toBe("preparing");

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 9: Zero legacy links on /dashboard/orders ──────────────────────────────
test("zero legacy /farmer or /business links exist anywhere on /dashboard/orders", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, farmer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });

  const allLinks = await page.locator("a[href]").all();
  const legacyLinks: string[] = [];

  for (const link of allLinks) {
    const href = await link.getAttribute("href");
    if (!href) continue;
    if (href.startsWith("/farmer") || href.startsWith("/business")) {
      legacyLinks.push(href);
    }
  }

  expect(legacyLinks).toEqual([]);
  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 10: Responsive desktop & mobile viewports ─────────────────────────────
test("renders cleanly on desktop and mobile viewports with no overflow", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, farmer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  // Desktop (1280px)
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-testid='v4-seller-orders-context-bar']")).toBeVisible();

  let hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasOverflow).toBe(false);

  // Mobile (375px)
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-testid='v4-seller-orders-context-bar']")).toBeVisible();

  hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasOverflow).toBe(false);

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 11: Clean dark mode rendering ─────────────────────────────────────────
test("renders cleanly in dark mode", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, farmer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-testid='v4-seller-orders-context-bar']")).toBeVisible();
  await expect(page.locator("h1")).toContainText("Wholesale Order Operations");

  expect(prodLeaks).toEqual([]);
  await context.close();
});
