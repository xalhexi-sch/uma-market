// =============================================================================
// UMA Market — V4 Unified Dashboard (/dashboard) Browser Verification
//
// Verifies:
// 1. Unauthenticated request to /dashboard redirects to /sign-in.
// 2. Authenticated access renders active business context bar, greeting, and quick actions.
// 3. OWNER vs STAFF role visibility (badges and role-scoped permissions guidance).
// 4. BUY-only business surfaces buyer orders and market actions (no produce listings).
// 5. SELL-only business surfaces produce listings snapshot (no buyer cart action).
// 6. BOTH (Buy & Sell) business surfaces both produce listings and buyer orders.
// 7. Zero legacy /farmer or /business links exist anywhere on /dashboard.
// 8. Mobile (375px) and desktop (1280px) viewports with no horizontal overflow.
// 9. Clean dark mode rendering.
// =============================================================================

import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authenticatedContext,
  PROD_APP_HOST,
  PROD_SUPABASE_HOST,
  resolvePersona,
  serviceClient,
  upsertTestProfile,
  type Persona,
} from "./harness";

const FIXTURES = {
  buyBusinessId:   "d5000002-0000-4000-8000-000000000010",
  buyMemberOwnerId:"d5000002-0000-4000-8000-000000000020",
  sellBusinessId:  "d5000002-0000-4000-8000-000000000030",
  sellMemberId:    "d5000002-0000-4000-8000-000000000040",
};

let admin: SupabaseClient;
let buyer: Persona;
let farmer: Persona;

let buyerBusinessId: string;
let buyerBusinessName: string;
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

  await upsertTestProfile(admin, buyer.clerkUserId, "business", "V4 Dashboard Buyer");
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "V4 Dashboard Producer");

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
    const biz = Array.isArray(bMember.businesses) ? bMember.businesses[0] : bMember.businesses;
    buyerBusinessName = (biz as { name?: string } | null)?.name || "Valley Fresh Kitchen";
    await admin
      .from("businesses")
      .update({ can_buy: true, can_sell: false, status: "active" })
      .eq("id", buyerBusinessId);
    await admin
      .from("business_members")
      .update({ role: "OWNER" })
      .eq("id", buyerMemberId);
  } else {
    buyerBusinessId = FIXTURES.buyBusinessId;
    buyerMemberId = FIXTURES.buyMemberOwnerId;
    buyerBusinessName = "Valley Fresh Kitchen";
    await admin.from("businesses").upsert({
      id: buyerBusinessId,
      name: buyerBusinessName,
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
    farmerBusinessId = FIXTURES.sellBusinessId;
    farmerMemberId = FIXTURES.sellMemberId;
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
});

test.afterAll(async () => {
  if (!admin) return;
  // Restore original state
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
  if (farmerBusinessId) {
    await admin
      .from("businesses")
      .update({ can_buy: false, can_sell: true })
      .eq("id", farmerBusinessId);
  }
});

// ── Test 1: Unauthenticated request redirects ──────────────────────────────────
test("unauthenticated access to /dashboard redirects to /sign-in", async ({ page }) => {
  const prodLeaks = trackProductionRequests(page);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/sign-in/);
  expect(page.url()).toContain("sign-in");
  expect(prodLeaks).toEqual([]);
});

// ── Test 2: Authenticated dashboard access & context bar ───────────────────────
test("authenticated user views /dashboard with active business context", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toBeVisible();

  const contextBar = page.locator("[data-testid='v4-dashboard-context-bar']");
  await expect(contextBar).toBeVisible();
  await expect(contextBar.locator("[data-testid='business-name']")).toHaveText(buyerBusinessName);
  await expect(contextBar.locator("[data-testid='role-badge']")).toHaveText("OWNER");
  await expect(contextBar.locator("[data-testid='capability-badge']")).toHaveText("Buyer Business");

  // Quick actions visible
  const quickActions = page.locator("[data-testid='quick-actions-section']");
  await expect(quickActions).toBeVisible();
  await expect(quickActions).toContainText("Browse Marketplace");
  await expect(quickActions).toContainText("My Orders");
  await expect(quickActions).toContainText("Shopping Cart");

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 3: OWNER vs STAFF role visibility ─────────────────────────────────────
test("distinguishes OWNER privileges and STAFF operational access", async ({ browser }) => {
  // Test as OWNER first
  const { context: ownerContext } = await authenticatedContext(browser, buyer);
  const ownerPage = await ownerContext.newPage();
  const prodLeaks1 = trackProductionRequests(ownerPage);

  await ownerPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(ownerPage.locator("[data-testid='role-badge']")).toHaveText("OWNER");
  const roleInfo = ownerPage.locator("[data-testid='role-info-section']");
  await expect(roleInfo).toContainText("Owner Privileges");
  await expect(roleInfo).toContainText("administrative and operational control");
  expect(prodLeaks1).toEqual([]);
  await ownerContext.close();

  // Switch role to STAFF temporarily
  await admin
    .from("business_members")
    .update({ role: "STAFF" })
    .eq("id", buyerMemberId);

  const { context: staffContext } = await authenticatedContext(browser, buyer);
  const staffPage = await staffContext.newPage();
  const prodLeaks2 = trackProductionRequests(staffPage);

  await staffPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(staffPage.locator("[data-testid='role-badge']")).toHaveText("STAFF");
  const staffRoleInfo = staffPage.locator("[data-testid='role-info-section']");
  await expect(staffRoleInfo).toContainText("Staff Access");
  await expect(staffRoleInfo).toContainText("Administrative settings are managed by the business owner");

  expect(prodLeaks2).toEqual([]);
  await staffContext.close();

  // Revert back to OWNER
  await admin
    .from("business_members")
    .update({ role: "OWNER" })
    .eq("id", buyerMemberId);
});

// ── Test 4: BUY-only business content ──────────────────────────────────────────
test("BUY-only business shows orders snapshot and cart action without produce listings", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  // Capability badge says Buyer Business
  await expect(page.locator("[data-testid='capability-badge']")).toHaveText("Buyer Business");

  // Orders snapshot is visible
  await expect(page.locator("[data-testid='orders-snapshot-section']")).toBeVisible();

  // Produce listings snapshot should NOT be present on BUY-only
  await expect(page.locator("[data-testid='products-snapshot-section']")).toHaveCount(0);

  // Shopping Cart action is present
  await expect(page.locator("a:has-text('Shopping Cart')")).toBeVisible();

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 5: SELL-only business content ─────────────────────────────────────────
test("SELL-only business shows produce listings snapshot without cart action", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, farmer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  // Capability badge says Producer
  await expect(page.locator("[data-testid='capability-badge']")).toHaveText("Producer");

  // Produce Listings snapshot IS present
  await expect(page.locator("[data-testid='products-snapshot-section']")).toBeVisible();

  // Buyer Shopping Cart quick action should NOT be visible for SELL-only
  const quickActions = page.locator("[data-testid='quick-actions-section']");
  await expect(quickActions.locator("a:has-text('Shopping Cart')")).toHaveCount(0);

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 6: BOTH capability business content ───────────────────────────────────
test("BOTH (Buy & Sell) business shows both produce listings and buyer actions", async ({ browser }) => {
  // Update buyer business to BOTH
  await admin
    .from("businesses")
    .update({ can_buy: true, can_sell: true })
    .eq("id", buyerBusinessId);

  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  // Capability badge says Buy & Sell
  await expect(page.locator("[data-testid='capability-badge']")).toHaveText("Buy & Sell");

  // Both Produce Listings and Orders snapshot are present
  await expect(page.locator("[data-testid='products-snapshot-section']")).toBeVisible();
  await expect(page.locator("[data-testid='orders-snapshot-section']")).toBeVisible();

  // Both Cart and Market actions are present
  await expect(page.locator("a:has-text('Shopping Cart')")).toBeVisible();

  expect(prodLeaks).toEqual([]);
  await context.close();

  // Revert back to BUY-only
  await admin
    .from("businesses")
    .update({ can_buy: true, can_sell: false })
    .eq("id", buyerBusinessId);
});

// ── Test 7: Zero legacy /farmer or /business links ──────────────────────────────
test("zero legacy /farmer or /business links exist anywhere on /dashboard", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  // Collect all links on page
  const allLinks = await page.locator("a[href]").all();
  const legacyLinks: string[] = [];

  for (const link of allLinks) {
    const href = await link.getAttribute("href");
    if (!href) continue;
    // Disallow links to legacy routes /farmer/* or /business/*
    if (href.startsWith("/farmer") || href.startsWith("/business")) {
      legacyLinks.push(href);
    }
  }

  expect(legacyLinks).toEqual([]);
  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 8: Responsive viewport & no horizontal overflow ───────────────────────
test("renders cleanly on desktop and mobile viewports with no overflow", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  // Desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-testid='v4-dashboard-context-bar']")).toBeVisible();

  let hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasOverflow).toBe(false);

  // Mobile
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-testid='v4-dashboard-context-bar']")).toBeVisible();

  hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasOverflow).toBe(false);

  expect(prodLeaks).toEqual([]);
  await context.close();
});

// ── Test 9: Clean dark mode rendering ─────────────────────────────────────────
test("renders cleanly in dark mode", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  const page = await context.newPage();
  const prodLeaks = trackProductionRequests(page);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-testid='v4-dashboard-context-bar']")).toBeVisible();
  await expect(page.locator("[data-testid='quick-actions-section']")).toBeVisible();

  expect(prodLeaks).toEqual([]);
  await context.close();
});
