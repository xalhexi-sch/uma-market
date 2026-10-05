// =============================================================================
// UMA Market — V4 Producer Operations (/dashboard/listings, /dashboard/inventory)
// Browser verification against the isolated security-test project.
//
// Requires migration 20261006100000_v4_producer_listings_inventory.sql.
//
// Verifies:
//  1. Unauthenticated access redirects to /sign-in.
//  2. BUY-only business sees the selling-required state and no producer data.
//  3. SELL-only OWNER: listings render with status, stock and moderation states;
//     tabs and search filter server-side; flagged listing can't be published.
//  4. Create listing (opening stock) → owned by the active business.
//  5. Edit listing; stock is read-only on the form.
//  6. Archive and restore from the row menu.
//  7. Cross-business: another business's listing is a 404; a forged business
//     cookie is ignored.
//  8. Inventory: attention list, add stock, loss larger than stock blocked,
//     stale count rejected after a concurrent change, activity history.
//  9. STAFF (Clerk role "business") can operate inventory.
// 10. BUY+SELL business can access producer tools (empty states).
// 11. Mobile (375px) and desktop (1280px) without horizontal overflow; dark mode.
// 12. No legacy /farmer or /business links; zero production requests.
// =============================================================================

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authenticatedContext,
  E2E_BASE_URL,
  PROD_APP_HOST,
  PROD_SUPABASE_HOST,
  resolvePersona,
  serviceClient,
  upsertTestProfile,
  type Persona,
} from "./harness";

const ACTIVE_BUSINESS_COOKIE = "uma_active_business_id";

const fid = (n: number) => `d5000005-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const FIX = {
  sellBiz: fid(0x101),
  bothBiz: fid(0x102),
  buyBiz: fid(0x103),
  otherBiz: fid(0x104), // farmer2 only
  tomatoes: fid(0x201), // live, healthy
  kale: fid(0x202), // live, out of stock
  garlic: fid(0x203), // live, below MOQ
  basil: fid(0x204), // draft, flagged by UMA
  squash: fid(0x205), // archived
  foreign: fid(0x206), // otherBiz
};

const BUSINESSES = [FIX.sellBiz, FIX.bothBiz, FIX.buyBiz, FIX.otherBiz];

let admin: SupabaseClient;
let farmer: Persona;
let buyer: Persona;
let farmer2: Persona;

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

async function openAs(
  browserContextFactory: () => Promise<{ context: BrowserContext }>,
  businessId: string
): Promise<{ context: BrowserContext; page: Page; leaks: string[] }> {
  const { context } = await browserContextFactory();
  await context.addCookies([{ name: ACTIVE_BUSINESS_COOKIE, value: businessId, url: E2E_BASE_URL }]);
  const page = await context.newPage();
  return { context, page, leaks: trackProductionRequests(page) };
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
}

async function expectNoLegacyLinks(page: Page): Promise<void> {
  const hrefs = await page.locator("a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? "")
  );
  expect(hrefs.filter((href) => href.startsWith("/farmer") || href.startsWith("/business"))).toEqual([]);
}

async function stockOf(productId: string): Promise<number> {
  const { data, error } = await admin.from("products").select("quantity_available").eq("id", productId).single();
  if (error) throw new Error(`stockOf(${productId}): ${error.message}`);
  return Number(data.quantity_available);
}

async function cleanupFixtures(): Promise<void> {
  // Cascades to product_images and inventory_movements.
  await admin.from("products").delete().in("business_id", BUSINESSES);
  await admin.from("business_members").delete().in("business_id", BUSINESSES);
  await admin.from("businesses").delete().in("id", BUSINESSES);
}

test.beforeAll(async () => {
  admin = serviceClient();
  farmer = await resolvePersona("farmer");
  buyer = await resolvePersona("business");
  farmer2 = await resolvePersona("farmer2");

  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "V4 Producer Ops Owner");
  await upsertTestProfile(admin, buyer.clerkUserId, "business", "V4 Producer Ops Staff");
  await upsertTestProfile(admin, farmer2.clerkUserId, "farmer", "V4 Producer Ops Outsider");

  await cleanupFixtures();

  const { data: category } = await admin.from("categories").select("id").eq("slug", "vegetables").maybeSingle();
  if (!category) throw new Error("category 'vegetables' missing in the security-test DB — run `npm run seed:demo`");

  const { error: bizErr } = await admin.from("businesses").insert([
    { id: FIX.sellBiz, name: "E2E Highland Farm", can_buy: false, can_sell: true, status: "active" },
    { id: FIX.bothBiz, name: "E2E Valley Co-op", can_buy: true, can_sell: true, status: "active" },
    { id: FIX.buyBiz, name: "E2E City Kitchen", can_buy: true, can_sell: false, status: "active" },
    { id: FIX.otherBiz, name: "E2E Rival Farm", can_buy: false, can_sell: true, status: "active" },
  ]);
  if (bizErr) throw new Error(`businesses: ${bizErr.message}`);

  const { error: memErr } = await admin.from("business_members").insert([
    { business_id: FIX.sellBiz, user_id: farmer.clerkUserId, role: "OWNER" },
    { business_id: FIX.sellBiz, user_id: buyer.clerkUserId, role: "STAFF" },
    { business_id: FIX.bothBiz, user_id: farmer.clerkUserId, role: "OWNER" },
    { business_id: FIX.buyBiz, user_id: farmer.clerkUserId, role: "OWNER" },
    { business_id: FIX.otherBiz, user_id: farmer2.clerkUserId, role: "OWNER" },
  ]);
  if (memErr) throw new Error(`business_members: ${memErr.message}`);

  const product = (
    id: string,
    name: string,
    quantity: number,
    extra: Record<string, unknown> = {},
    businessId = FIX.sellBiz,
    owner = farmer.clerkUserId
  ) => ({
    id,
    business_id: businessId,
    farmer_clerk_id: owner,
    category_id: category.id,
    name,
    price_per_unit: 120,
    unit: "kg",
    quantity_available: quantity,
    min_order_quantity: 1,
    status: "active",
    moderation_status: "approved",
    ...extra,
  });

  const { error: prodErr } = await admin.from("products").insert([
    product(FIX.tomatoes, "E2E PO Tomatoes", 100),
    product(FIX.kale, "E2E PO Kale", 0),
    product(FIX.garlic, "E2E PO Garlic", 3, { min_order_quantity: 5 }),
    product(FIX.basil, "E2E PO Basil", 12, { status: "draft", moderation_status: "flagged" }),
    product(FIX.squash, "E2E PO Squash", 8, { status: "archived" }),
    product(FIX.foreign, "E2E PO Rival Onions", 50, {}, FIX.otherBiz, farmer2.clerkUserId),
  ]);
  if (prodErr) throw new Error(`products: ${prodErr.message}`);
});

test.afterAll(async () => {
  if (admin) await cleanupFixtures();
});

const asFarmer = (browser: Parameters<typeof authenticatedContext>[0]) => () => authenticatedContext(browser, farmer);
const asBuyer = (browser: Parameters<typeof authenticatedContext>[0]) => () => authenticatedContext(browser, buyer);

// ── 1. Unauthenticated ──────────────────────────────────────────────────────
test("unauthenticated access to producer pages redirects to /sign-in", async ({ page }) => {
  const leaks = trackProductionRequests(page);
  for (const path of ["/dashboard/listings", "/dashboard/inventory", "/dashboard/listings/new"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/sign-in/);
  }
  expect(leaks).toEqual([]);
});

// ── 2. BUY-only ─────────────────────────────────────────────────────────────
test("BUY-only business gets the selling-required state and no producer data", async ({ browser }) => {
  const { context, page, leaks } = await openAs(asFarmer(browser), FIX.buyBiz);

  for (const path of ["/dashboard/listings", "/dashboard/inventory", "/dashboard/listings/new"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("selling-capability-required")).toBeVisible();
    await expect(page.getByTestId("listing-row")).toHaveCount(0);
    await expect(page.getByTestId("stock-row")).toHaveCount(0);
  }
  await expect(page.getByTestId("v4-workspace-nav").getByRole("link", { name: "Listings" })).toHaveCount(0);

  // Even a direct edit URL for a real listing is not served to a BUY-only context.
  await page.goto(`/dashboard/listings/${FIX.tomatoes}/edit`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("selling-capability-required")).toBeVisible();
  await expect(page.locator("#name")).toHaveCount(0);

  expect(leaks).toEqual([]);
  await context.close();
});

// ── 3. Listings overview ────────────────────────────────────────────────────
test("SELL-only OWNER sees listings with status, stock and moderation states", async ({ browser }) => {
  const { context, page, leaks } = await openAs(asFarmer(browser), FIX.sellBiz);

  await page.goto("/dashboard/listings", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Listings" })).toBeVisible();
  await expect(page.getByTestId("business-name")).toHaveText("E2E Highland Farm");
  await expect(page.getByTestId("role-badge")).toHaveText("OWNER");

  const rows = page.getByTestId("listing-row");
  await expect(rows).toHaveCount(4); // archived excluded from "All"
  await expect(page.locator(`[data-listing-id='${FIX.kale}']`)).toContainText("Out of stock");
  await expect(page.locator(`[data-listing-id='${FIX.garlic}']`)).toContainText("Below minimum order");
  await expect(page.locator(`[data-listing-id='${FIX.basil}'] [data-testid='moderation-badge']`)).toHaveText(
    "Under UMA review"
  );

  // Tabs are links with server-side filtering.
  const tabs = page.getByTestId("listings-view-tabs");
  await tabs.getByRole("link", { name: /Needs attention/ }).click();
  await page.waitForURL(/view=attention/);
  await expect(rows).toHaveCount(3);
  await expect(page.locator(`[data-listing-id='${FIX.tomatoes}']`)).toHaveCount(0);

  await tabs.getByRole("link", { name: /Archived/ }).click();
  await page.waitForURL(/view=archived/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("E2E PO Squash");

  // Search (GET form, works without client JS).
  await page.goto("/dashboard/listings", { waitUntil: "domcontentloaded" });
  await page.getByRole("searchbox", { name: "Search listings" }).fill("garlic");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/q=garlic/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("E2E PO Garlic");

  // A flagged listing can't be published by the producer.
  await page.goto("/dashboard/listings?view=drafts", { waitUntil: "domcontentloaded" });
  await page.locator(`[data-listing-id='${FIX.basil}']`).getByTestId("listing-more-actions").click();
  const publish = page.getByRole("menuitem", { name: /Publish \(blocked by UMA review\)/ });
  await expect(publish).toBeVisible();
  await expect(publish).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");

  await expectNoLegacyLinks(page);
  expect(leaks).toEqual([]);
  await context.close();
});

// ── 4–6. Create, edit, archive, restore ─────────────────────────────────────
test("create, edit, archive and restore a listing", async ({ browser }) => {
  const { context, page, leaks } = await openAs(asFarmer(browser), FIX.sellBiz);

  // Fill only after hydration: the shared header can re-render the tree on the
  // client, which would discard values typed into the server-rendered inputs.
  await page.goto("/dashboard/listings/new", { waitUntil: "networkidle" });
  await expect(async () => {
    await page.locator("#name").fill("E2E PO Sweet Potatoes");
    await page.locator("#price").fill("85.5");
    await page.locator("#qty").fill("40");
    await page.locator("#min-order").fill("2");
    await expect(page.locator("#name")).toHaveValue("E2E PO Sweet Potatoes", { timeout: 1_000 });
    await expect(page.locator("#qty")).toHaveValue("40", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Create Product" }).click();
  await page.waitForURL(/\/dashboard\/listings$/);

  const created = page.getByTestId("listing-row").filter({ hasText: "E2E PO Sweet Potatoes" });
  await expect(created).toHaveCount(1);
  await expect(created).toContainText("Draft");
  await expect(created).toContainText("40 kg");

  const { data: product } = await admin
    .from("products")
    .select("id, business_id, quantity_available, status")
    .eq("name", "E2E PO Sweet Potatoes")
    .eq("business_id", FIX.sellBiz)
    .single();
  expect(product?.business_id).toBe(FIX.sellBiz);
  const { data: opening } = await admin
    .from("inventory_movements")
    .select("movement_type, quantity_delta, created_by")
    .eq("product_id", product!.id);
  expect(opening).toEqual([{ movement_type: "OPENING", quantity_delta: 40, created_by: farmer.clerkUserId }]);

  // Edit: stock is read-only on the form; price change persists.
  await created.getByRole("link", { name: /Edit E2E PO Sweet Potatoes/ }).click();
  await page.waitForURL(/\/edit$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("product-form-stock-readonly")).toContainText("40");
  await expect(page.locator("#qty")).toHaveCount(0);
  await expect(async () => {
    await page.locator("#price").fill("90");
    await expect(page.locator("#price")).toHaveValue("90", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.waitForURL(/\/dashboard\/listings$/);
  await expect(created).toContainText("₱90.00");
  expect(await stockOf(product!.id)).toBe(40);

  // Archive from the row menu.
  await created.getByTestId("listing-more-actions").click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(created).toHaveCount(0);

  await page.goto("/dashboard/listings?view=archived", { waitUntil: "domcontentloaded" });
  const archived = page.getByTestId("listing-row").filter({ hasText: "E2E PO Sweet Potatoes" });
  await expect(archived).toContainText("Archived");
  await archived.getByTestId("listing-more-actions").click();
  await page.getByRole("menuitem", { name: "Restore to drafts" }).click();
  await expect(archived).toHaveCount(0);

  await page.goto("/dashboard/listings?view=drafts", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("listing-row").filter({ hasText: "E2E PO Sweet Potatoes" })).toContainText("Draft");

  expect(leaks).toEqual([]);
  await context.close();
});

// ── 7. Cross-business ───────────────────────────────────────────────────────
test("another business's listing is not reachable and a forged business cookie is ignored", async ({ browser }) => {
  const { context, page, leaks } = await openAs(asFarmer(browser), FIX.sellBiz);

  // notFound() may stream behind loading.tsx with HTTP 200, so assert the rendered outcome.
  await page.goto(`/dashboard/listings/${FIX.foreign}/edit`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.locator("#name")).toHaveCount(0);
  await expect(page.getByText("E2E PO Rival Onions")).toHaveCount(0);

  // Forge the active-business cookie to a business the farmer doesn't belong to.
  await context.addCookies([{ name: ACTIVE_BUSINESS_COOKIE, value: FIX.otherBiz, url: E2E_BASE_URL }]);
  await page.goto("/dashboard/listings", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("business-name")).not.toHaveText("E2E Rival Farm");
  await expect(page.getByText("E2E PO Rival Onions")).toHaveCount(0);

  expect(leaks).toEqual([]);
  await context.close();
});

// ── 8. Inventory workflows ──────────────────────────────────────────────────
test("inventory: attention list, add stock, blocked over-loss, stale count, history", async ({ browser }) => {
  await admin.from("products").update({ quantity_available: 100 }).eq("id", FIX.tomatoes);
  await admin.from("products").update({ quantity_available: 0 }).eq("id", FIX.kale);

  const { context, page, leaks } = await openAs(asFarmer(browser), FIX.sellBiz);
  await page.goto("/dashboard/inventory", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Inventory" })).toBeVisible();

  const attention = page.getByTestId("inventory-attention");
  await expect(attention.getByTestId("attention-row")).toHaveCount(2); // Kale (out), Garlic (below MOQ)
  await expect(attention.locator(`[data-listing-id='${FIX.kale}']`)).toContainText("Buyers can't order");
  await expect(attention.locator(`[data-listing-id='${FIX.tomatoes}']`)).toHaveCount(0);
  await expect(page.getByTestId("inventory-attention-summary")).toContainText("1 out of stock");

  // Add stock to Kale from the attention list.
  await attention.locator(`[data-listing-id='${FIX.kale}']`).getByTestId("update-stock-trigger").click();
  let dialog = page.getByTestId("inventory-adjustment-dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator(`#stock-quantity-${FIX.kale}`).fill("20");
  await dialog.locator(`#stock-reason-${FIX.kale}`).fill("E2E harvest");
  await dialog.getByTestId("inventory-adjustment-submit").click();
  await expect(dialog).toBeHidden();
  const kaleRow = page.locator(`#stock-${FIX.kale}`);
  await expect(kaleRow.getByTestId("stock-row-quantity")).toHaveText("20");
  await expect(attention.locator(`[data-listing-id='${FIX.kale}']`)).toHaveCount(0);
  expect(await stockOf(FIX.kale)).toBe(20);
  const activity = page.getByTestId("inventory-activity");
  await expect(activity.getByTestId("inventory-activity-row").first()).toContainText("Stock received");
  await expect(activity.getByTestId("inventory-activity-row").first()).toContainText("E2E harvest");

  // A loss larger than stock is blocked before submit.
  const tomatoesRow = page.locator(`#stock-${FIX.tomatoes}`);
  await tomatoesRow.getByTestId("update-stock-trigger").click();
  dialog = page.getByTestId("inventory-adjustment-dialog");
  await dialog.getByText("Record loss").click();
  await dialog.locator(`#stock-quantity-${FIX.tomatoes}`).fill("1000");
  await expect(dialog).toContainText("Only 100 kg on hand.");
  await expect(dialog.getByTestId("inventory-adjustment-submit")).toBeDisabled();

  // A count based on a stale balance is rejected after a concurrent change.
  await dialog.getByText("Correct count").click();
  await admin.from("products").update({ quantity_available: 80 }).eq("id", FIX.tomatoes); // e.g. a sale elsewhere
  await dialog.locator(`#stock-quantity-${FIX.tomatoes}`).fill("95");
  await dialog.getByTestId("inventory-adjustment-submit").click();
  await expect(dialog.getByTestId("inventory-adjustment-error")).toContainText("Stock changed to 80 kg");
  expect(await stockOf(FIX.tomatoes)).toBe(80);
  await expect(dialog.getByTestId("dialog-on-hand")).toHaveText("80 kg");

  // Retrying against the refreshed balance succeeds.
  await dialog.getByTestId("inventory-adjustment-submit").click();
  await expect(dialog).toBeHidden();
  expect(await stockOf(FIX.tomatoes)).toBe(95);

  expect(leaks).toEqual([]);
  await context.close();
});

// ── 9. STAFF ────────────────────────────────────────────────────────────────
test("STAFF member (buyer Clerk role) can operate inventory for the business", async ({ browser }) => {
  const before = await stockOf(FIX.garlic);
  const { context, page, leaks } = await openAs(asBuyer(browser), FIX.sellBiz);

  await page.goto("/dashboard/inventory", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("role-badge")).toHaveText("STAFF");
  await page.locator(`#stock-${FIX.garlic}`).getByTestId("update-stock-trigger").click();
  const dialog = page.getByTestId("inventory-adjustment-dialog");
  await dialog.locator(`#stock-quantity-${FIX.garlic}`).fill("7.5");
  await dialog.getByTestId("inventory-adjustment-submit").click();
  await expect(dialog).toBeHidden();
  expect(await stockOf(FIX.garlic)).toBe(before + 7.5);

  await page.goto("/dashboard/listings", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("listing-row").first()).toBeVisible();

  expect(leaks).toEqual([]);
  await context.close();
});

// ── 10. BUY+SELL business, empty states ─────────────────────────────────────
test("BUY+SELL business can access producer tools and sees empty states", async ({ browser }) => {
  const { context, page, leaks } = await openAs(asFarmer(browser), FIX.bothBiz);

  await page.goto("/dashboard/listings", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("capability-badge")).toHaveText("Buy & Sell");
  await expect(page.getByTestId("listings-empty-state")).toBeVisible();
  await expect(page.getByTestId("listings-empty-state").getByRole("link", { name: "Create a listing" })).toBeVisible();

  await page.goto("/dashboard/inventory", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("inventory-empty-state")).toBeVisible();
  await expect(page.getByTestId("inventory-activity-empty")).toBeVisible();

  expect(leaks).toEqual([]);
  await context.close();
});

// ── 11. Responsive + dark mode ──────────────────────────────────────────────
test("listings and inventory render without overflow on mobile and desktop, light and dark", async ({ browser }) => {
  const { context, page, leaks } = await openAs(asFarmer(browser), FIX.sellBiz);

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const viewport of [
      { width: 375, height: 740 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      for (const path of ["/dashboard/listings", "/dashboard/inventory"]) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("h1")).toBeVisible();
        await expect(page.getByTestId(path.endsWith("listings") ? "listings-list" : "inventory-stock-list")).toBeVisible();
        if (scheme === "dark") {
          await expect(page.locator("html")).toHaveClass(/dark/);
        }
        await expectNoHorizontalOverflow(page);
      }
    }
  }

  // Mobile row actions stay reachable.
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto("/dashboard/listings", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("listing-more-actions").first()).toBeVisible();

  await expectNoLegacyLinks(page);
  expect(leaks).toEqual([]);
  await context.close();
});
