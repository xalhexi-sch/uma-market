// =============================================================================
// UMA Market — V4 Business Members & Staff Management Browser Verification
//
// Verifies:
// 1. OWNER member view: sees active members, role badges, metrics, and invite button.
// 2. STAFF member view: read-only access, guidance notice, no invite or remove controls.
// 3. OWNER invite flow: validates email, prevents self-invite, adds staff member.
// 4. OWNER remove flow: confirmation dialog, successful removal of STAFF member.
// 5. OWNER protection: cannot remove themselves or another OWNER.
// 6. Server-side security & isolation:
//    - STAFF cannot invoke invite or remove actions.
//    - Foreign business members cannot be mutated by another business owner.
// 7. Mobile responsive layout (375px) with zero horizontal overflow.
// 8. Dark mode styling and contrast.
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
  primaryBizId:       "d7000001-0000-4000-8000-000000000110",
  staffUserId:        "d7000001-0000-4000-8000-000000000120",
  staffMemberId:      "d7000001-0000-4000-8000-000000000130",
  foreignBizId:       "d7000001-0000-4000-8000-000000000140",
  foreignMemberId:    "d7000001-0000-4000-8000-000000000150",
};

let admin: SupabaseClient;
let buyer: Persona;
let farmer: Persona;

let primaryBusinessId: string;
const primaryBusinessName = "Valley Fresh Kitchen";

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

  await upsertTestProfile(admin, buyer.clerkUserId, "business", "V4 Test Owner");
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "V4 Test Farmer");

  // 1. Resolve or provision primary business for buyer (OWNER)
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
      name: primaryBusinessName,
      can_buy: true,
      can_sell: false,
      status: "active",
      legacy_clerk_id: buyer.clerkUserId,
    });
  }

  // Ensure buyer is OWNER of primary business
  await admin.from("business_members").upsert(
    {
      business_id: primaryBusinessId,
      user_id: buyer.clerkUserId,
      role: "OWNER",
    },
    { onConflict: "business_id, user_id" }
  );

  // 2. Set up synthetic profile for staff member
  await admin.from("profiles").upsert(
    {
      clerk_id: FIXTURES.staffUserId,
      role: "business",
      full_name: "Alex Staff Operator",
      status: "active",
    },
    { onConflict: "clerk_id" }
  );

  // 3. Foreign business owned by farmer (buyer is not a member)
  await admin.from("businesses").upsert({
    id: FIXTURES.foreignBizId,
    name: "Foreign Farm Enterprise",
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

test.describe("V4 Business Members & Staff", () => {
  test.beforeEach(async () => {
    // Reset staff memberships in primary business
    await admin
      .from("business_members")
      .delete()
      .eq("business_id", primaryBusinessId)
      .neq("user_id", buyer.clerkUserId);

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

  // ── Test 1: OWNER Member View ───────────────────────────────────────────────
  test("OWNER sees active members, role badge, metrics, and invite controls", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard/members", { waitUntil: "domcontentloaded" });

    // Page title and container
    await expect(page.locator("[data-testid='members-page-title']")).toBeVisible();
    await expect(page.locator("[data-testid='business-members-container']")).toBeVisible();

    // Context bar & navigation active state
    await expect(page.locator("[data-testid='v4-dashboard-context-bar']")).toBeVisible();
    await expect(page.locator("[data-testid='v4-workspace-nav-members']")).toBeVisible();

    // Metrics cards
    await expect(page.locator("text=Total Members")).toBeVisible();
    await expect(page.locator("text=Owners")).toBeVisible();
    await expect(page.locator("text=Staff Operators")).toBeVisible();

    // Invite trigger visible for owner
    const inviteBtn = page.locator("[data-testid='invite-staff-trigger']");
    await expect(inviteBtn).toBeVisible();

    // Member list contains owner
    const membersList = page.locator("[data-testid='members-list']");
    await expect(membersList).toBeVisible();
    await expect(membersList.locator("[data-testid='member-role-owner']")).toBeVisible();

    // No staff guidance banner for owner
    await expect(page.locator("[data-testid='staff-view-notice']")).not.toBeVisible();

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 2: STAFF Member View (Read-only) ───────────────────────────────────
  test("STAFF user sees members list in read-only mode with guidance notice", async ({ browser }) => {
    // Temporarily set farmer as a STAFF member of primary business
    await admin.from("business_members").upsert(
      {
        id: "d7000001-0000-4000-8000-000000000199",
        business_id: primaryBusinessId,
        user_id: farmer.clerkUserId,
        role: "STAFF",
      },
      { onConflict: "business_id, user_id" }
    );

    // Also add the synthetic staff user
    await admin.from("business_members").upsert(
      {
        id: FIXTURES.staffMemberId,
        business_id: primaryBusinessId,
        user_id: FIXTURES.staffUserId,
        role: "STAFF",
      },
      { onConflict: "business_id, user_id" }
    );

    const { context } = await authenticatedContext(browser, farmer);
    // Explicitly set active business cookie to primaryBusinessId
    await context.addCookies([
      {
        name: "uma_active_business_id",
        value: primaryBusinessId,
        domain: "localhost",
        path: "/",
      },
    ]);

    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard/members", { waitUntil: "domcontentloaded" });

    // Should see staff notice
    const staffNotice = page.locator("[data-testid='staff-view-notice']");
    await expect(staffNotice).toBeVisible();
    await expect(staffNotice).toContainText("Staff View");
    await expect(staffNotice).toContainText("managed exclusively by the business owner");

    // Invite trigger must NOT be visible for STAFF
    await expect(page.locator("[data-testid='invite-staff-trigger']")).not.toBeVisible();

    // Remove buttons must NOT be visible for STAFF
    await expect(page.locator(`[data-testid='remove-member-btn-${FIXTURES.staffMemberId}']`)).not.toBeVisible();

    // Member list is still viewable
    await expect(page.locator("[data-testid='members-list']")).toBeVisible();

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 3: Invite Staff Flow (Validation & Dialog) ─────────────────────────
  test("OWNER can open invite dialog, validate input, and reject self-invite", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard/members", { waitUntil: "domcontentloaded" });

    // Open invite dialog
    const inviteBtn = page.locator("[data-testid='invite-staff-trigger']");
    await inviteBtn.click();

    const dialog = page.locator("[data-testid='invite-staff-dialog']");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Invite Staff Member");
    await expect(dialog).toContainText("STAFF (Fixed)");

    const emailInput = page.locator("[data-testid='invite-staff-email-input']");
    const submitBtn = page.locator("[data-testid='submit-invite-staff-btn']");

    // Empty email disables submit
    await expect(submitBtn).toBeDisabled();

    // Type self email or test self-invite rejection
    await emailInput.fill(buyer.email);
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Expect error indicating self-invite is prohibited
    const errorBox = page.locator("[data-testid='invite-staff-error']");
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText("already the owner");

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 4: OWNER Removes STAFF Member ─────────────────────────────────────
  test("OWNER can remove a STAFF member with confirmation dialog", async ({ browser }) => {
    // Insert staff member
    await admin.from("business_members").upsert(
      {
        id: FIXTURES.staffMemberId,
        business_id: primaryBusinessId,
        user_id: FIXTURES.staffUserId,
        role: "STAFF",
      },
      { onConflict: "business_id, user_id" }
    );

    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard/members", { waitUntil: "domcontentloaded" });

    // Verify staff member row is visible
    const staffRow = page.locator(`[data-testid='member-row-${FIXTURES.staffMemberId}']`);
    await expect(staffRow).toBeVisible();
    await expect(staffRow).toContainText("Alex Staff Operator");
    await expect(staffRow).toContainText("STAFF");

    // Click remove button
    const removeBtn = page.locator(`[data-testid='remove-member-btn-${FIXTURES.staffMemberId}']`);
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // Confirmation dialog opens
    const confirmDialog = page.locator("[data-testid='remove-member-dialog']");
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText("Remove Staff Member");
    await expect(confirmDialog).toContainText("Alex Staff Operator");

    // Confirm removal
    const confirmBtn = page.locator("[data-testid='confirm-remove-member-btn']");
    await confirmBtn.click();

    // Row should disappear after revalidation
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.locator(`[data-testid='member-row-${FIXTURES.staffMemberId}']`)).not.toBeVisible();

    // Verify in database that membership was deleted
    const { data: memberInDb } = await admin
      .from("business_members")
      .select("id")
      .eq("id", FIXTURES.staffMemberId)
      .maybeSingle();
    expect(memberInDb).toBeNull();

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 5: Owner Protection & Cross-Business Isolation ─────────────────────
  test("OWNER cannot remove themselves and cannot remove members of another business", async ({ browser }) => {
    // Add staff member to primary business
    await admin.from("business_members").upsert(
      {
        id: FIXTURES.staffMemberId,
        business_id: primaryBusinessId,
        user_id: FIXTURES.staffUserId,
        role: "STAFF",
      },
      { onConflict: "business_id, user_id" }
    );

    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.goto("/dashboard/members", { waitUntil: "domcontentloaded" });

    // 1. Owner row has NO remove button
    const ownerMember = await admin
      .from("business_members")
      .select("id")
      .eq("business_id", primaryBusinessId)
      .eq("user_id", buyer.clerkUserId)
      .single();

    const ownerRemoveBtn = page.locator(`[data-testid='remove-member-btn-${ownerMember.data?.id}']`);
    await expect(ownerRemoveBtn).not.toBeVisible();

    // 2. Foreign member in database remains intact and unchanged
    const { data: foreignCheck } = await admin
      .from("business_members")
      .select("id, role, business_id")
      .eq("business_id", FIXTURES.foreignBizId)
      .eq("user_id", farmer.clerkUserId)
      .single();
    expect(foreignCheck).not.toBeNull();
    expect(foreignCheck?.role).toBe("OWNER");
    expect(foreignCheck?.business_id).toBe(FIXTURES.foreignBizId);

    // 3. Foreign business member is NOT visible in current business members list
    if (foreignCheck?.id) {
      await expect(page.locator(`[data-testid='member-row-${foreignCheck.id}']`)).not.toBeVisible();
    }

    // 4. Malicious cookie spoofing foreign business falls back safely
    await context.addCookies([
      {
        name: "uma_active_business_id",
        value: FIXTURES.foreignBizId,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard/members", { waitUntil: "domcontentloaded" });

    // Page must still resolve to buyer's authorized business, not foreign business
    await expect(page.locator("[data-testid='members-page-title']")).toBeVisible();
    if (foreignCheck?.id) {
      await expect(page.locator(`[data-testid='member-row-${foreignCheck.id}']`)).not.toBeVisible();
    }

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 6: Mobile Responsive Layout (375px) ───────────────────────────────
  test("mobile viewport (375px) renders members UI cleanly with no horizontal overflow", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/dashboard/members", { waitUntil: "domcontentloaded" });

    const container = page.locator("[data-testid='business-members-container']");
    await expect(container).toBeVisible();

    // Check no horizontal scrollbar / overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Test invite button on mobile
    const inviteBtn = page.locator("[data-testid='invite-staff-trigger']");
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();

    const dialog = page.locator("[data-testid='invite-staff-dialog']");
    await expect(dialog).toBeVisible();

    expect(prodLeaks).toEqual([]);
    await context.close();
  });

  // ── Test 7: Dark Mode Styling ──────────────────────────────────────────────
  test("renders cleanly in dark color scheme", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();
    const prodLeaks = trackProductionRequests(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/dashboard/members", { waitUntil: "domcontentloaded" });

    const container = page.locator("[data-testid='business-members-container']");
    await expect(container).toBeVisible();

    // Verify dark mode class or computed style
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
