// =============================================================================
// UMA Market — canonical /profile route regression suite
//
// 1. Unauthenticated visitor is sent to /sign-in
// 2. Authenticated buyer reaches /profile via legacy /business/profile
// 3. Authenticated producer reaches /profile via legacy /farmer/profile
// 4. Inactive/suspended/revoked gate is enforced on /profile
//
// /profile is ONE canonical route for every persona (buyer + producer). The
// buyer/producer split lives only in ProfileForm field labels, driven by the
// session role — never in separate route trees.
// =============================================================================

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

test.beforeAll(async () => {
  admin = serviceClient();
  [buyer, producer] = await Promise.all([
    resolvePersona("business"),
    resolvePersona("farmer"),
  ]);

  await Promise.all([
    upsertTestProfile(admin, buyer.clerkUserId, "business", "Canonical Profile Buyer"),
    upsertTestProfile(admin, producer.clerkUserId, "farmer", "Canonical Profile Producer"),
  ]);
});

test.describe("Canonical /profile route", () => {
  test("unauthenticated visitor is redirected to /sign-in", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    const url = new URL(page.url());
    expect(url.pathname).toBe("/sign-in");
  });

  test("authenticated buyer reaches /profile via legacy /business/profile", async ({
    browser,
  }) => {
    const { context } = await authenticatedContext(browser, buyer);
    try {
      const page = await context.newPage();
      await page.goto("/business/profile", { waitUntil: "domcontentloaded" });

      // Single canonical destination, no redirect loop into legacy trees.
      expect(new URL(page.url()).pathname).toBe("/profile");
      expect(new URL(page.url()).pathname).not.toMatch(/^\/(farmer|business)(\/|$)/);

      // Buyer persona renders the shared ProfileForm with buyer field labels.
      await expect(page.getByLabel("Business / Restaurant Name")).toBeVisible();
      await expect(page.getByRole("button", { name: "Save Profile" })).toBeVisible();
      await page.close();
    } finally {
      await context.close();
    }
  });

  test("authenticated producer reaches /profile via legacy /farmer/profile", async ({
    browser,
  }) => {
    const { context } = await authenticatedContext(browser, producer);
    try {
      const page = await context.newPage();
      await page.goto("/farmer/profile", { waitUntil: "domcontentloaded" });

      expect(new URL(page.url()).pathname).toBe("/profile");
      expect(new URL(page.url()).pathname).not.toMatch(/^\/(farmer|business)(\/|$)/);

      // Producer persona renders the same shared ProfileForm, producer labels.
      await expect(page.getByLabel("Farm / Producer Name")).toBeVisible();
      await expect(page.getByRole("button", { name: "Save Profile" })).toBeVisible();
      await page.close();
    } finally {
      await context.close();
    }
  });

  test("inactive/suspended/revoked account gate is enforced on /profile", async ({
    browser,
  }) => {
    const { context } = await authenticatedContext(browser, producer);
    try {
      await setProfileStatus(admin, producer.clerkUserId, "revoked");

      const page = await context.newPage();
      await page.goto("/profile", { waitUntil: "domcontentloaded" });

      // The dashboard layout must terminate revoked sessions before any
      // profile content renders.
      const url = new URL(page.url());
      expect(url.pathname).toBe("/sign-in");
      expect(url.searchParams.get("revoked")).toBe("true");
      await expect(page.getByLabel("Farm / Producer Name")).toHaveCount(0);
      await page.close();
    } finally {
      await setProfileStatus(admin, producer.clerkUserId, "active");
      await context.close();
    }
  });
});
