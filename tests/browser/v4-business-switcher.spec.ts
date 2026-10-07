// =============================================================================
// UMA Market — V4 Business Switcher Browser Verification
//
// Verifies:
// 1. Single-business user experience (clean, compact, shows identity & create action).
// 2. Multi-business user experience (lists all businesses with OWNER/STAFF roles).
// 3. Switching active business updates identity, cookie, and dashboard state.
// 4. Unauthorized business selection is rejected server-side (fails safe).
// 5. Lightweight "+ Create another business" flow (provisions, sets OWNER, activates).
// 6. Sidebar switcher on layout-wrapped routes (/profile).
// 7. Mobile (375px) responsive behavior via drawer with no overflow.
// 8. Clean dark mode rendering.
// 9. Zero production network requests.
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
  fallbackBuyBizId:   "d7000001-0000-4000-8000-000000000010",
  secondaryBizId:     "d7000001-0000-4000-8000-000000000030",
  secondaryMemberId:  "d7000001-0000-4000-8000-000000000040",
  foreignBizId:       "d7000001-0000-4000-8000-000000000050",
  foreignMemberId:    "d7000001-0000-4000-8000-000000000060",
};

let admin: SupabaseClient;
let buyer: Persona;
let farmer: Persona;

let buyerBusinessId: string;
const buyerBusinessName = "Valley Fresh Kitchen";

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

  await upsertTestProfile(admin, buyer.clerkUserId, "business", "V4 Switcher Buyer");
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "V4 Switcher Farmer");

  // 1. Resolve buyer's primary business (by legacy_clerk_id)
  const { data: existingBiz } = await admin
    .from("businesses")
    .select("id, name")
    .eq("legacy_clerk_id", buyer.clerkUserId)
    .maybeSingle();

  if (existingBiz?.id) {
    buyerBusinessId = existingBiz.id;
  } else {
    buyerBusinessId = FIXTURES.fallbackBuyBizId;
    await admin.from("businesses").upsert({
      id: buyerBusinessId,
      name: buyerBusinessName,
      can_buy: true,
      can_sell: false,
      status: "active",
      legacy_clerk_id: buyer.clerkUserId,
    });
  }

  // Ensure primary business member row exists
  await admin.from("business_members").upsert(
    {
      business_id: buyerBusinessId,
      user_id: buyer.clerkUserId,
      role: "OWNER",
    },
    { onConflict: "business_id, user_id" }
  );

  // 2. Foreign business owned by farmer (buyer is NOT a member)
  await admin.from("businesses").upsert({
    id: FIXTURES.foreignBizId,
    name: "Farmer Only Co-op",
    can_buy: false,
    can_sell: true,
    status: "active",
    legacy_clerk_id: farmer.clerkUserId,
  });
  await admin.from("business_members").upsert(
    {
      id: FIXTURES.foreignMemberId,
      business_id: FIXTURES.foreignBizId,
      user_id: farmer.clerkUserId,
      role: "OWNER",
    },
    { onConflict: "business_id, user_id" }
  );
});

test.describe("V4 Business Switcher", () => {
  test.beforeEach(async () => {
    // Clean up any secondary memberships for buyer
    await admin
      .from("business_members")
      .delete()
      .eq("user_id", buyer.clerkUserId)
      .neq("business_id", buyerBusinessId);

    // Reset primary business state
    await admin
      .from("businesses")
      .update({ name: buyerBusinessName, can_buy: true, can_sell: false, status: "active" })
      .eq("id", buyerBusinessId);

    await admin.from("business_members").upsert(
      {
        business_id: buyerBusinessId,
        user_id: buyer.clerkUserId,
        role: "OWNER",
      },
      { onConflict: "business_id, user_id" }
    );
  });

  // ── Test 1: Single-business user in header ──────────────────────────────────
  test("single-business user sees active identity in header and simple switcher menu", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Switcher trigger in header
    const trigger = page.locator("[data-testid='header-business-switcher-trigger']");
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText(buyerBusinessName);
    await expect(trigger).toContainText("OWNER");

    // Open switcher popover
    await trigger.click();
    const popover = page.locator("[data-testid='business-switcher-popover']");
    await expect(popover).toBeVisible();

    // Verify single membership item is marked active
    const activeItem = popover.locator(`[data-testid='business-item-${buyerBusinessId}']`);
    await expect(activeItem).toBeVisible();
    await expect(activeItem).toContainText(buyerBusinessName);
    await expect(activeItem).toContainText("OWNER");
    await expect(activeItem).toContainText("Active");

    // Create another business button is available
    await expect(popover.locator("[data-testid='create-business-trigger']")).toBeVisible();

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 2: Multi-business user display & role badges ───────────────────────
  test("multi-business user sees all memberships with distinct roles", async ({ browser }) => {
    // Add secondary business with STAFF role
    await admin.from("businesses").upsert({
      id: FIXTURES.secondaryBizId,
      name: "Batangas Logistics Hub",
      can_buy: true,
      can_sell: true,
      status: "active",
      legacy_clerk_id: null,
    });
    await admin.from("business_members").upsert(
      {
        id: FIXTURES.secondaryMemberId,
        business_id: FIXTURES.secondaryBizId,
        user_id: buyer.clerkUserId,
        role: "STAFF",
      },
      { onConflict: "business_id, user_id" }
    );

    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const trigger = page.locator("[data-testid='header-business-switcher-trigger']");
    await trigger.click();

    const popover = page.locator("[data-testid='business-switcher-popover']");
    await expect(popover).toBeVisible();

    // Primary business item
    const primaryItem = popover.locator(`[data-testid='business-item-${buyerBusinessId}']`);
    await expect(primaryItem).toBeVisible();
    await expect(primaryItem).toContainText(buyerBusinessName);
    await expect(primaryItem).toContainText("OWNER");
    await expect(primaryItem).toContainText("Active");

    // Secondary business item
    const secondaryItem = popover.locator(`[data-testid='business-item-${FIXTURES.secondaryBizId}']`);
    await expect(secondaryItem).toBeVisible();
    await expect(secondaryItem).toContainText("Batangas Logistics Hub");
    await expect(secondaryItem).toContainText("STAFF");
    await expect(secondaryItem).not.toContainText("Active");

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 3: Switching active business ──────────────────────────────────────
  test("switching active business updates visible identity and dashboard context", async ({ browser }) => {
    // Add secondary business
    await admin.from("businesses").upsert({
      id: FIXTURES.secondaryBizId,
      name: "Batangas Logistics Hub",
      can_buy: true,
      can_sell: true,
      status: "active",
      legacy_clerk_id: null,
    });
    await admin.from("business_members").upsert(
      {
        id: FIXTURES.secondaryMemberId,
        business_id: FIXTURES.secondaryBizId,
        user_id: buyer.clerkUserId,
        role: "STAFF",
      },
      { onConflict: "business_id, user_id" }
    );

    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Open switcher and click secondary business
    await page.locator("[data-testid='header-business-switcher-trigger']").click();
    const secondaryItem = page.locator(`[data-testid='business-item-${FIXTURES.secondaryBizId}']`);
    await secondaryItem.click();

    // Identity in header should update
    const trigger = page.locator("[data-testid='header-business-switcher-trigger']");
    await expect(trigger).toContainText("Batangas Logistics Hub");
    await expect(trigger).toContainText("STAFF");

    // Open switcher again to confirm active checkmark moved
    await trigger.click();
    const popover = page.locator("[data-testid='business-switcher-popover']");
    const updatedSecondary = popover.locator(`[data-testid='business-item-${FIXTURES.secondaryBizId}']`);
    await expect(updatedSecondary).toContainText("Active");

    // Switch back to primary
    const primaryItem = popover.locator(`[data-testid='business-item-${buyerBusinessId}']`);
    await primaryItem.click();

    await expect(trigger).toContainText(buyerBusinessName);
    await expect(trigger).toContainText("OWNER");

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 4: Unauthorized business selection rejected ───────────────────────
  test("unauthorized business selection is rejected and cookie tampering fails safe", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    // Set cookie maliciously to foreign business ID
    await context.addCookies([
      {
        name: "uma_active_business_id",
        value: FIXTURES.foreignBizId,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Server must reject unauthorized cookie and fall back to authorized membership
    const trigger = page.locator("[data-testid='header-business-switcher-trigger']");
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText(buyerBusinessName);
    await expect(trigger).toContainText("OWNER");

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 5: Create another business flow ───────────────────────────────────
  test("creates a new business, assigns OWNER role, and activates it", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Open switcher and trigger dialog
    await page.locator("[data-testid='header-business-switcher-trigger']").click();
    await page.locator("[data-testid='create-business-trigger']").click();

    const dialog = page.locator("[data-testid='create-business-dialog']");
    await expect(dialog).toBeVisible();

    // Fill form
    const uniqueName = `Benguet Highland Hub ${Date.now()}`;
    await page.locator("[data-testid='create-business-name-input']").fill(uniqueName);
    await page.locator("[data-testid='create-business-cap-both']").click();

    // Submit
    await page.locator("[data-testid='create-business-submit-btn']").click();

    // Dialog closes and page reloads with new active business
    await expect(dialog).not.toBeVisible();
    const trigger = page.locator("[data-testid='header-business-switcher-trigger']");
    await expect(trigger).toContainText(uniqueName);
    await expect(trigger).toContainText("OWNER");

    // Open switcher to confirm both businesses are visible and new one is active
    await trigger.click();
    const popover = page.locator("[data-testid='business-switcher-popover']");
    await expect(popover).toContainText(uniqueName);
    await expect(popover).toContainText(buyerBusinessName);

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 6: Sidebar switcher on /profile ────────────────────────────────────
  test("sidebar switcher renders and operates on layout-wrapped routes", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/profile", { waitUntil: "domcontentloaded" });

    const trigger = page.locator("[data-testid='sidebar-business-switcher-trigger']");
    await expect(trigger).toBeVisible();
    await expect(page.locator("[data-testid='sidebar-business-name']")).toHaveText(buyerBusinessName);
    await expect(page.locator("[data-testid='sidebar-business-role']")).toHaveText("OWNER");

    // Open switcher popover from sidebar
    await trigger.click();
    const popover = page.locator("[data-testid='business-switcher-popover']");
    await expect(popover).toBeVisible();
    await expect(popover).toContainText(buyerBusinessName);

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 7: Mobile 375px responsive behavior via drawer ─────────────────────
  test("renders cleanly on mobile viewport (375px) without overflow", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Open mobile drawer
    const menuBtn = page.locator("button[aria-label='Open menu']");
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // Drawer switcher trigger
    const drawerTrigger = page.locator("[data-testid='drawer-business-switcher-trigger']");
    await expect(drawerTrigger).toBeVisible();
    await drawerTrigger.click();

    const popover = page.locator("[data-testid='business-switcher-popover']");
    await expect(popover).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 8: Clean dark mode rendering ──────────────────────────────────────
  test("renders switcher cleanly in dark mode", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const trigger = page.locator("[data-testid='header-business-switcher-trigger']");
    await expect(trigger).toBeVisible();
    await trigger.click();

    const popover = page.locator("[data-testid='business-switcher-popover']");
    await expect(popover).toBeVisible();

    expect(prodLeaks).toEqual([]);
    await context.close();
  });
});
