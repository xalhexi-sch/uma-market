// Focused coverage for the three canonical V4 resource routes.

import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authenticatedContext,
  resolvePersona,
  serviceClient,
  setProfileStatus,
  upsertTestProfile,
  type Persona,
} from "./harness";

let admin: SupabaseClient;
let buyer: Persona;
let producer: Persona;
const notificationDedupeKey = `v4-resource-pages:${Date.now()}`;
const notificationActionUrl = `/notifications?resource-test=${Date.now()}`;

test.beforeAll(async () => {
  admin = serviceClient();
  [buyer, producer] = await Promise.all([
    resolvePersona("business"),
    resolvePersona("farmer"),
  ]);

  await Promise.all([
    upsertTestProfile(admin, buyer.clerkUserId, "business", "V4 Resource Buyer"),
    upsertTestProfile(admin, producer.clerkUserId, "farmer", "V4 Resource Producer"),
  ]);

  await admin.from("notifications").delete().eq("dedupe_key", notificationDedupeKey);
  const { error } = await admin.from("notifications").insert({
    recipient_clerk_id: buyer.clerkUserId,
    type: "new_message",
    title: "V4 resource notification",
    body: "This notification verifies the canonical notification page.",
    entity_type: "message",
    entity_id: "c0000007-0000-4000-8000-000000000099",
    action_url: notificationActionUrl,
    dedupe_key: notificationDedupeKey,
  });
  if (error) throw new Error(`Could not provision notification route fixture: ${error.message}`);
});

test.afterAll(async () => {
  if (admin) {
    const { error } = await admin
      .from("notifications")
      .delete()
      .eq("dedupe_key", notificationDedupeKey);
    if (error) throw new Error(`Could not clean notification route fixture: ${error.message}`);
  }
});

test("/producers publicly lists producer profiles with canonical profile links", async ({ page }) => {
  const response = await page.goto("/producers", { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Producers" })).toBeVisible();
  await expect(page.getByText("V4 Resource Producer Co", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /V4 Resource Producer Co/ }),
  ).toHaveAttribute("href", `/producers/${producer.clerkUserId}`);
});

test("/favorites redirects unauthenticated visitors to sign in", async ({ page }) => {
  await page.goto("/favorites", { waitUntil: "domcontentloaded" });

  expect(new URL(page.url()).pathname).toBe("/sign-in");
});

test("/favorites shows an intentional empty state to an authenticated user", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  try {
    const page = await context.newPage();
    await page.goto("/favorites", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Favorites" })).toBeVisible();
    await expect(page.getByText("No favorites yet", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore products" })).toHaveAttribute("href", "/products");
    await page.close();
  } finally {
    await context.close();
  }
});

test("/notifications redirects unauthenticated visitors to sign in", async ({ page }) => {
  await page.goto("/notifications", { waitUntil: "domcontentloaded" });

  expect(new URL(page.url()).pathname).toBe("/sign-in");
});

test("/notifications keeps the existing inactive-account gate", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  try {
    await setProfileStatus(admin, buyer.clerkUserId, "suspended");
    const page = await context.newPage();
    await page.goto("/notifications", { waitUntil: "domcontentloaded" });

    const url = new URL(page.url());
    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("revoked")).toBe("true");
    await page.close();
  } finally {
    await setProfileStatus(admin, buyer.clerkUserId, "active");
    await context.close();
  }
});

test("/notifications lists notifications, preserves their URL, and marks unread rows read", async ({ browser }) => {
  const { context } = await authenticatedContext(browser, buyer);
  try {
    const page = await context.newPage();
    await page.goto("/notifications", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    const notificationLink = page.locator(`a[href="${notificationActionUrl}"]`);
    await expect(notificationLink).toContainText("V4 resource notification");

    await notificationLink.click();
    await expect.poll(() => {
      const url = new URL(page.url());
      return `${url.pathname}${url.search}`;
    }).toBe(notificationActionUrl);
    await expect.poll(async () => {
      const { data, error } = await admin
        .from("notifications")
        .select("read_at")
        .eq("dedupe_key", notificationDedupeKey)
        .single();
      if (error) throw error;
      return data.read_at;
    }).not.toBeNull();
    await page.close();
  } finally {
    await context.close();
  }
});
