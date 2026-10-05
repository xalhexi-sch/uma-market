// =============================================================================
// UMA Market — V4 Unified Relationship Messaging (/messages) Browser Verification
//
// Verifies:
// 1. Unauthenticated request to /messages redirects to sign-in.
// 2. Authenticated business views /messages with active context bar and conversations.
// 3. Counterparty (Producer) views same conversation from their perspective.
// 4. Conversation detail (/messages/[id]) renders thread, sender names, and product context card.
// 5. Message Producer on product page resolves canonical relationship conversation.
// 6. Different product from same producer routes to SAME relationship conversation.
// 7. Strict business isolation: Unrelated business gets 404 when visiting conversation.
// 8. Mobile viewport has no horizontal overflow.
// 9. Zero legacy message links in new V4 messaging views.
// 10. Zero production traffic.
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
  buyerBusinessId:  "d6000002-0000-4000-8000-000000000010",
  buyerMemberId:    "d6000002-0000-4000-8000-000000000020",
  producerBusinessId: "d6000002-0000-4000-8000-000000000030",
  producerMemberId: "d6000002-0000-4000-8000-000000000035",
  productId1:       "d6000002-0000-4000-8000-000000000041",
  productId2:       "d6000002-0000-4000-8000-000000000042",
  conversationId:   "d6000002-0000-4000-8000-000000000060",
  messageId1:       "d6000002-0000-4000-8000-000000000071",
  messageId2:       "d6000002-0000-4000-8000-000000000072",
};

let admin: SupabaseClient;
let buyer: Persona;
let farmer: Persona;

let buyerBusinessId: string;
let buyerBusinessName: string;
let buyerMemberId: string;

let producerBusinessId: string;
let producerBusinessName: string;
let producerMemberId: string;

let conversationId: string;
let isNewBuyerBiz = false;
let isNewProducerBiz = false;

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

  await upsertTestProfile(admin, buyer.clerkUserId, "business", "V4 Test Buyer");
  await upsertTestProfile(admin, farmer.clerkUserId, "farmer", "V4 Test Producer");

  // 1. Resolve or seed Buyer Business
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
    buyerBusinessName = (biz as { name?: string } | null)?.name || "V4 Buyer Co";
    await admin
      .from("businesses")
      .update({ can_buy: true, can_sell: false, status: "active" })
      .eq("id", buyerBusinessId);
  } else {
    buyerBusinessId = FIXTURES.buyerBusinessId;
    buyerMemberId = FIXTURES.buyerMemberId;
    buyerBusinessName = "V4 Artisan Bakery";
    isNewBuyerBiz = true;
    await admin.from("businesses").upsert({
      id: buyerBusinessId,
      name: buyerBusinessName,
      can_buy: true,
      can_sell: false,
      status: "active",
    });
    await admin.from("business_members").upsert({
      id: buyerMemberId,
      business_id: buyerBusinessId,
      user_id: buyer.clerkUserId,
      role: "OWNER",
    });
  }

  // 2. Resolve or seed Producer Business
  const { data: fMember } = await admin
    .from("business_members")
    .select("id, business_id, role, businesses(id, name, can_buy, can_sell)")
    .eq("user_id", farmer.clerkUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fMember?.business_id && fMember.businesses) {
    producerBusinessId = fMember.business_id;
    producerMemberId = fMember.id;
    const biz = Array.isArray(fMember.businesses) ? fMember.businesses[0] : fMember.businesses;
    producerBusinessName = (biz as { name?: string } | null)?.name || "V4 Producer Co";
    await admin
      .from("businesses")
      .update({ can_buy: false, can_sell: true, status: "active" })
      .eq("id", producerBusinessId);
  } else {
    producerBusinessId = FIXTURES.producerBusinessId;
    producerMemberId = FIXTURES.producerMemberId;
    producerBusinessName = "V4 Mountain Strawberry Farm";
    isNewProducerBiz = true;
    await admin.from("businesses").upsert({
      id: producerBusinessId,
      name: producerBusinessName,
      can_buy: false,
      can_sell: true,
      status: "active",
    });
    await admin.from("business_members").upsert({
      id: producerMemberId,
      business_id: producerBusinessId,
      user_id: farmer.clerkUserId,
      role: "OWNER",
    });
  }

  // 3. Seed Products belonging to the farmer
  const { data: cat } = await admin.from("categories").select("id").limit(1).single();
  const categoryId = cat?.id;

  await admin.from("products").upsert([
    {
      id: FIXTURES.productId1,
      farmer_clerk_id: farmer.clerkUserId,
      category_id: categoryId,
      name: "Organic Sweet Strawberries",
      description: "Hand-picked berries from Benguet",
      price_per_unit: 140.0,
      unit: "kg",
      min_order_quantity: 2,
      quantity_available: 50,
      status: "active",
    },
    {
      id: FIXTURES.productId2,
      farmer_clerk_id: farmer.clerkUserId,
      category_id: categoryId,
      name: "Farm Fresh Blueberries",
      description: "Crisp berries",
      price_per_unit: 220.0,
      unit: "box",
      min_order_quantity: 1,
      quantity_available: 30,
      status: "active",
    },
  ]);

  // 4. Resolve or create Canonical Conversation between Buyer and Producer
  const canonA = buyerBusinessId < producerBusinessId ? buyerBusinessId : producerBusinessId;
  const canonB = buyerBusinessId < producerBusinessId ? producerBusinessId : buyerBusinessId;

  const { data: existingConv } = await admin
    .from("conversations")
    .select("id")
    .eq("business_a_id", canonA)
    .eq("business_b_id", canonB)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const { data: newConv } = await admin
      .from("conversations")
      .insert({
        business_a_id: canonA,
        business_b_id: canonB,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    conversationId = newConv!.id;
  }

  // 5. Seed Messages with product and order context
  await admin.from("messages").upsert([
    {
      id: FIXTURES.messageId1,
      conversation_id: conversationId,
      sender_clerk_id: buyer.clerkUserId,
      sender_business_id: buyerBusinessId,
      body: "Hi! Can we order 10 kg of your Organic Sweet Strawberries for Friday?",
      product_id: FIXTURES.productId1,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: FIXTURES.messageId2,
      conversation_id: conversationId,
      sender_clerk_id: farmer.clerkUserId,
      sender_business_id: producerBusinessId,
      body: "Hello! Yes, Friday morning pickup will be ready.",
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
  ]);
});

test.afterAll(async () => {
  if (!admin) return;
  await admin.from("messages").delete().in("id", [FIXTURES.messageId1, FIXTURES.messageId2]);
  if (conversationId && conversationId === FIXTURES.conversationId) {
    await admin.from("conversations").delete().eq("id", conversationId);
  }
  await admin.from("products").delete().in("id", [FIXTURES.productId1, FIXTURES.productId2]);
  if (isNewBuyerBiz) {
    await admin.from("business_members").delete().eq("id", buyerMemberId);
    await admin.from("businesses").delete().eq("id", buyerBusinessId);
  }
  if (isNewProducerBiz) {
    await admin.from("business_members").delete().eq("id", producerMemberId);
    await admin.from("businesses").delete().eq("id", producerBusinessId);
  }
});

test.describe("V4 Unified Messaging (/messages)", () => {
  test("1. Unauthenticated request to /messages redirects to /sign-in", async ({ page }) => {
    const offenders = trackProductionRequests(page);

    await page.goto("/messages");
    await expect(page).toHaveURL(/\/sign-in/);

    expect(offenders).toEqual([]);
  });

  test("2. Authenticated business views /messages with active context and conversation row", async ({
    browser,
  }) => {
    const { context } = await authenticatedContext(browser, buyer);
    await context.addCookies([
      { name: "uma_active_business_id", value: buyerBusinessId, domain: "localhost", path: "/" },
      { name: "uma_active_business", value: buyerBusinessId, domain: "localhost", path: "/" },
    ]);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    try {
      await page.goto("/messages");
      await page.waitForLoadState("networkidle");

      // Verify Page Title & Header
      await expect(page.locator("h1")).toContainText("Messages");

      // Verify Context Bar
      await expect(page.locator("aside")).toContainText(buyerBusinessName);
      await expect(page.locator("aside")).toContainText("OWNER");

      // Verify Conversation Row with counterparty name and snippet
      await expect(page.locator("body")).toContainText(producerBusinessName);
      await expect(page.locator("body")).toContainText("Hello! Yes, Friday morning pickup will be ready.");

      expect(offenders).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("3. Producer views same conversation from their perspective", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, farmer);
    await context.addCookies([
      { name: "uma_active_business_id", value: producerBusinessId, domain: "localhost", path: "/" },
      { name: "uma_active_business", value: producerBusinessId, domain: "localhost", path: "/" },
    ]);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    try {
      await page.goto("/messages");
      await page.waitForLoadState("networkidle");

      // Producer should see the buyer business as counterparty
      await expect(page.locator("body")).toContainText(buyerBusinessName);

      expect(offenders).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("4. Conversation detail (/messages/[id]) renders thread, sender names, and product context card", async ({
    browser,
  }) => {
    const { context } = await authenticatedContext(browser, buyer);
    await context.addCookies([
      { name: "uma_active_business_id", value: buyerBusinessId, domain: "localhost", path: "/" },
      { name: "uma_active_business", value: buyerBusinessId, domain: "localhost", path: "/" },
    ]);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    try {
      await page.goto(`/messages/${conversationId}`);
      await page.waitForLoadState("networkidle");

      // Verify Thread Header
      await expect(page.locator("h1")).toContainText(producerBusinessName);

      // Verify Messages
      await expect(page.locator("body")).toContainText("Hi! Can we order 10 kg");
      await expect(page.locator("body")).toContainText("Friday morning pickup will be ready");

      // Verify Product Context Card
      await expect(page.locator("body")).toContainText("Organic Sweet Strawberries");
      await expect(page.locator("body")).toContainText("₱140.00 / kg");

      // Verify Message Composer
      await expect(page.getByTestId("message-input")).toBeVisible();
      await expect(page.getByTestId("message-send-btn")).toBeVisible();

      expect(offenders).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("5. Message Producer on product page resolves canonical relationship conversation", async ({
    browser,
  }) => {
    const { context } = await authenticatedContext(browser, buyer);
    await context.addCookies([
      { name: "uma_active_business_id", value: buyerBusinessId, domain: "localhost", path: "/" },
      { name: "uma_active_business", value: buyerBusinessId, domain: "localhost", path: "/" },
    ]);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    try {
      await page.goto(`/products/${FIXTURES.productId1}`);
      await page.waitForLoadState("networkidle");

      // Click "Message producer" button
      const messageBtn = page.getByTestId("message-producer-button");
      await expect(messageBtn).toBeVisible();
      await messageBtn.click();

      // Should redirect to /messages/[conversationId]?productId=...
      await page.waitForURL(new RegExp(`/messages/${conversationId}`));
      expect(page.url()).toContain(`productId=${FIXTURES.productId1}`);

      expect(offenders).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("6. Different product from same producer routes to SAME relationship conversation", async ({
    browser,
  }) => {
    const { context } = await authenticatedContext(browser, buyer);
    await context.addCookies([
      { name: "uma_active_business_id", value: buyerBusinessId, domain: "localhost", path: "/" },
      { name: "uma_active_business", value: buyerBusinessId, domain: "localhost", path: "/" },
    ]);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    try {
      await page.goto(`/products/${FIXTURES.productId2}`);
      await page.waitForLoadState("networkidle");

      // Click "Message producer" on product 2
      const messageBtn = page.getByTestId("message-producer-button");
      await expect(messageBtn).toBeVisible();
      await messageBtn.click();

      // Must route to the SAME conversation ID
      await page.waitForURL(new RegExp(`/messages/${conversationId}`));
      expect(page.url()).toContain(conversationId);

      expect(offenders).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("7. Strict business isolation: Unrelated business gets 404 when visiting conversation", async ({
    browser,
  }) => {
    const unrelatedBizId = "d6000002-0000-4000-8000-000000000999";
    await admin.from("businesses").upsert({
      id: unrelatedBizId,
      name: "Unrelated Third Party",
      can_buy: true,
      can_sell: false,
      status: "active",
    });
    await admin.from("business_members").upsert({
      id: "d6000002-0000-4000-8000-000000000998",
      business_id: unrelatedBizId,
      user_id: buyer.clerkUserId,
      role: "OWNER",
    });

    const { context } = await authenticatedContext(browser, buyer);
    await context.addCookies([
      { name: "uma_active_business_id", value: unrelatedBizId, domain: "localhost", path: "/" },
      { name: "uma_active_business", value: unrelatedBizId, domain: "localhost", path: "/" },
    ]);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    try {
      const res = await page.goto(`/messages/${conversationId}`);
      expect(res?.status() === 404 || (await page.locator("body").textContent())?.includes("404")).toBeTruthy();

      expect(offenders).toEqual([]);
    } finally {
      await context.close();
      await admin.from("business_members").delete().eq("id", "d6000002-0000-4000-8000-000000000998");
      await admin.from("businesses").delete().eq("id", unrelatedBizId);
    }
  });

  test("8. Mobile viewport has no horizontal overflow", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    await context.addCookies([
      { name: "uma_active_business_id", value: buyerBusinessId, domain: "localhost", path: "/" },
      { name: "uma_active_business", value: buyerBusinessId, domain: "localhost", path: "/" },
    ]);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    try {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/messages");
      await page.waitForLoadState("networkidle");

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      expect(offenders).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("9. Zero legacy message links in new V4 messaging views", async ({ browser }) => {
    const { context } = await authenticatedContext(browser, buyer);
    await context.addCookies([
      { name: "uma_active_business_id", value: buyerBusinessId, domain: "localhost", path: "/" },
      { name: "uma_active_business", value: buyerBusinessId, domain: "localhost", path: "/" },
    ]);
    const page = await context.newPage();
    const offenders = trackProductionRequests(page);

    try {
      await page.goto("/messages");
      await page.waitForLoadState("networkidle");

      const links = await page.locator("a").evaluateAll((elements: HTMLElement[]) =>
        elements.map((el) => el.getAttribute("href")).filter(Boolean)
      );

      const legacyLinks = links.filter(
        (h) =>
          h?.startsWith("/business/messages") ||
          h?.startsWith("/farmer/messages") ||
          h?.startsWith("/business/orders") ||
          h?.startsWith("/farmer/orders")
      );

      expect(legacyLinks).toEqual([]);
      expect(offenders).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
