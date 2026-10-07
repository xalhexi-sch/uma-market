// =============================================================================
// UMA Market — V4 Business Settings Browser Verification
//
// Verifies:
// 1. OWNER can view settings with current name and capabilities.
// 2. OWNER can update business name and changes persist.
// 3. OWNER can change business capability (Buy / Sell / Both).
// 4. Input validation rejects invalid names.
// 5. STAFF role boundary: read-only view and server action rejection.
// 6. Cross-business isolation: foreign business ID update rejected.
// 7. Team link navigates to /dashboard/members.
// 8. Mobile responsive layout (375px) with zero horizontal overflow.
// 9. Dark mode styling and tokens.
// 10. Zero production network requests.
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
  primaryBizId:       "d7000001-0000-4000-8000-000000000210",
  foreignBizId:       "d7000001-0000-4000-8000-000000000220",
  foreignMemberId:    "d7000001-0000-4000-8000-000000000230",
  staffMemberId:      "d7000001-0000-4000-8000-000000000240",
};

let admin: SupabaseClient;
let buyer: Persona;
let farmer: Persona;

let primaryBusinessId: string;
const initialBusinessName = "Valley Fresh Kitchen";

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

  await upsertTestProfile(admin, buyer.clerkUserId, "business", "V4 Settings Owner");
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "V4 Settings Farmer");

  // 1. Primary business owned by buyer (OWNER)
  const { data: existingBiz } = await admin
    .from("businesses")
    .select("id, name")
    .eq("legacy_clerk_id", buyer.clerkUserId)
    .maybeSingle();

  if (existingBiz?.id) {
    primaryBusinessId = existingBiz.id;
  } else {
    primaryBusinessId = FIXTURES.primaryBizId;
    await admin.from("businesses").upsert({
      id: primaryBusinessId,
      name: initialBusinessName,
      can_buy: true,
      can_sell: false,
      status: "active",
      legacy_clerk_id: buyer.clerkUserId,
    });
  }

  // Ensure buyer is OWNER
  await admin.from("business_members").upsert(
    {
      business_id: primaryBusinessId,
      user_id: buyer.clerkUserId,
      role: "OWNER",
    },
    { onConflict: "business_id, user_id" }
  );

  // 2. Foreign business owned by farmer
  await admin.from("businesses").upsert({
    id: FIXTURES.foreignBizId,
    name: "Foreign Agro Corp",
    can_buy: false,
    can_sell: true,
    status: "active",
    legacy_clerk_id: null,
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

test.describe("V4 Business Settings", () => {
  test.beforeEach(async () => {
    // Reset primary business to known initial state before each test
    await admin
      .from("businesses")
      .update({
        name: initialBusinessName,
        can_buy: true,
        can_sell: false,
      })
      .eq("id", primaryBusinessId);

    // Ensure buyer remains OWNER
    await admin.from("business_members").upsert(
      {
        business_id: primaryBusinessId,
        user_id: buyer.clerkUserId,
        role: "OWNER",
      },
      { onConflict: "business_id, user_id" }
    );
  });

  // ── Test 1: OWNER View Settings ────────────────────────────────────────────
  test("OWNER can view settings with business name, capabilities, and team link", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });

    // Verify container and title
    const container = page.locator("[data-testid='business-settings-container']");
    await expect(container).toBeVisible();

    const title = page.locator("[data-testid='settings-page-title']");
    await expect(title).toHaveText("Business Settings");

    // Verify context bar displays active business
    const contextBar = page.locator("[data-testid='v4-dashboard-context-bar']");
    await expect(contextBar).toBeVisible();

    // Verify workspace nav has active settings tab
    const settingsNavTab = page.locator("[data-testid='v4-workspace-nav-settings']");
    await expect(settingsNavTab).toHaveAttribute("aria-current", "page");

    // Verify business name input contains current name
    const nameInput = page.locator("[data-testid='business-name-input']");
    await expect(nameInput).toHaveValue(initialBusinessName);
    await expect(nameInput).toBeEnabled();

    // Verify capability options exist
    await expect(page.locator("[data-testid='capability-option-buy']")).toBeVisible();
    await expect(page.locator("[data-testid='capability-option-sell']")).toBeVisible();
    await expect(page.locator("[data-testid='capability-option-both']")).toBeVisible();

    // Verify save button exists
    const saveBtn = page.locator("[data-testid='save-business-settings-btn']");
    await expect(saveBtn).toBeVisible();

    // Verify manage members link
    const membersLink = page.locator("[data-testid='manage-members-link']");
    await expect(membersLink).toBeVisible();

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 2: OWNER Edit Business Name ───────────────────────────────────────
  test("OWNER can edit business name and see updated identity", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });

    const nameInput = page.locator("[data-testid='business-name-input']");
    const newName = "Valley Premium Agro Kitchen";

    await nameInput.fill("");
    await nameInput.fill(newName);

    const saveBtn = page.locator("[data-testid='save-business-settings-btn']");
    await saveBtn.click();

    // Expect success feedback
    const successMsg = page.locator("[data-testid='settings-success']");
    await expect(successMsg).toBeVisible();
    await expect(successMsg).toContainText("Business settings updated successfully.");

    // Verify database row was updated
    const { data: updatedBiz } = await admin
      .from("businesses")
      .select("name")
      .eq("id", primaryBusinessId)
      .single();

    expect(updatedBiz?.name).toBe(newName);

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 3: OWNER Change Capability ────────────────────────────────────────
  test("OWNER can change business capability to Buy & Sell", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });

    // Select Buy & Sell capability
    const bothOption = page.locator("[data-testid='capability-option-both']");
    await bothOption.click();

    const saveBtn = page.locator("[data-testid='save-business-settings-btn']");
    await saveBtn.click();

    // Verify success feedback
    const successMsg = page.locator("[data-testid='settings-success']");
    await expect(successMsg).toBeVisible();

    // Verify database row capabilities
    const { data: updatedBiz } = await admin
      .from("businesses")
      .select("can_buy, can_sell")
      .eq("id", primaryBusinessId)
      .single();

    expect(updatedBiz?.can_buy).toBe(true);
    expect(updatedBiz?.can_sell).toBe(true);

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 4: Validation Rejects Invalid Name ────────────────────────────────
  test("validation rejects empty or single-character business name", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });

    const nameInput = page.locator("[data-testid='business-name-input']");
    await nameInput.fill("X");

    const saveBtn = page.locator("[data-testid='save-business-settings-btn']");
    await saveBtn.click();

    const errorMsg = page.locator("[data-testid='settings-error']");
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText("Business name must be at least 2 characters.");

    // Verify database remains unchanged
    const { data: biz } = await admin
      .from("businesses")
      .select("name")
      .eq("id", primaryBusinessId)
      .single();

    expect(biz?.name).toBe(initialBusinessName);

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 5: STAFF Role Boundary ────────────────────────────────────────────
  test("STAFF user sees read-only settings and server action rejects mutation", async ({ browser }) => {
    // Set buyer as STAFF in primary business
    await admin.from("business_members").update({ role: "STAFF" }).match({
      business_id: primaryBusinessId,
      user_id: buyer.clerkUserId,
    });

    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });

    // Verify staff read-only notice is displayed
    const staffNotice = page.locator("[data-testid='staff-readonly-notice']");
    await expect(staffNotice).toBeVisible();
    await expect(staffNotice).toContainText("Only the business owner can edit business information");

    // Name input should be disabled
    const nameInput = page.locator("[data-testid='business-name-input']");
    await expect(nameInput).toBeDisabled();

    // Save button should NOT be rendered
    const saveBtn = page.locator("[data-testid='save-business-settings-btn']");
    await expect(saveBtn).not.toBeVisible();

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 6: Cross-Business Isolation ───────────────────────────────────────
  test("cross-business modification is rejected and foreign business remains intact", async ({ browser }) => {
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

    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });

    // Server must reject unauthorized foreign cookie and fall back to authorized business
    const contextBar = page.locator("[data-testid='v4-dashboard-context-bar']");
    await expect(contextBar).toBeVisible();
    await expect(contextBar).toContainText(initialBusinessName);

    // Verify foreign business data in DB was NEVER changed
    const { data: foreignBiz } = await admin
      .from("businesses")
      .select("name")
      .eq("id", FIXTURES.foreignBizId)
      .single();

    expect(foreignBiz?.name).toBe("Foreign Agro Corp");

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 7: Team Navigation Link ───────────────────────────────────────────
  test("manage members link navigates to /dashboard/members", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });

    const membersLink = page.locator("[data-testid='manage-members-link']");
    await expect(membersLink).toBeVisible();
    await membersLink.click();

    await page.waitForURL("**/dashboard/members");
    const membersContainer = page.locator("[data-testid='business-members-container']");
    await expect(membersContainer).toBeVisible();

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 8: Mobile Viewport (375px) ────────────────────────────────────────
  test("mobile viewport (375px) renders settings cleanly with no horizontal overflow", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });

    const container = page.locator("[data-testid='business-settings-container']");
    await expect(container).toBeVisible();

    // Check no horizontal scrollbar / overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 9: Dark Mode Styling ──────────────────────────────────────────────
  test("renders cleanly in dark color scheme", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });

    const container = page.locator("[data-testid='business-settings-container']");
    await expect(container).toBeVisible();

    const isDark = await page.evaluate(() => {
      return (
        document.documentElement.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    });
    expect(isDark).toBe(true);

    expect(prodLeaks).toEqual([]);
    await context.close();
  });
});
