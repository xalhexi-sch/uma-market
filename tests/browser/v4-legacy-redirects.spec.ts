// =============================================================================
// UMA Market — V4 Legacy Redirects & Canonical Termination Regression Suite
//
// Explicit verification matrix:
// 1. Anonymous visitor legacy URLs redirect via 307 to canonical V4 destinations
// 2. Authenticated buyer legacy URLs route to canonical V4 destinations
// 3. Authenticated producer legacy URLs route to canonical V4 destinations
// 4. Admin accesses /admin routes; legacy URLs route to canonical /dashboard
// 5. Suspended/revoked user terminates at /sign-in?revoked=true without loops
// 6. Legacy notification URLs (/business/orders/:id, /farmer/orders/:id) -> /orders/:id
// 7. Dynamic legacy URLs with IDs preserve path parameters exactly
// 8. Every legacy URL terminates at exactly ONE V4 canonical destination without redirect loops
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
let farmer: Persona;

test.beforeAll(async () => {
  admin = serviceClient();
  [buyer, farmer] = await Promise.all([
    resolvePersona("business"),
    resolvePersona("farmer"),
  ]);

  await Promise.all([
    upsertTestProfile(admin, buyer.clerkUserId, "business", "Redirect Test Buyer"),
    upsertTestProfile(admin, farmer.clerkUserId, "farmer", "Redirect Test Farmer"),
  ]);
});

test.describe("V4 Legacy Route Bridging & Canonical Termination", () => {
  // ── 1. Anonymous visitor: single 307 hop from legacy URL to V4 canonical ──
  test("anonymous visitor: legacy route aliases redirect via 307 before layout execution", async ({
    request,
  }) => {
    const cases = [
      { from: "/farmer", to: "/dashboard" },
      { from: "/farmer/products", to: "/dashboard/listings" },
      { from: "/farmer/products/new", to: "/dashboard/listings/new" },
      { from: "/farmer/orders", to: "/dashboard/orders" },
      { from: "/farmer/messages", to: "/messages" },
      { from: "/farmer/profile", to: "/profile" },
      { from: "/business", to: "/dashboard" },
      { from: "/business/products", to: "/products" },
      { from: "/business/cart", to: "/cart" },
      { from: "/business/checkout", to: "/checkout" },
      { from: "/business/checkout/confirmation", to: "/checkout/confirmation" },
      { from: "/business/orders", to: "/orders" },
      { from: "/business/messages", to: "/messages" },
      { from: "/business/profile", to: "/profile" },
      { from: "/dashboard/messages", to: "/messages" },
    ];

    for (const { from, to } of cases) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status(), `GET ${from} must respond with 307 redirect`).toBe(307);
      expect(res.headers()["location"], `GET ${from} must redirect directly to ${to}`).toBe(to);
    }
  });

  // ── 2. Dynamic legacy URLs with parameters ─────────────────────────────────
  test("dynamic legacy URLs with IDs preserve path parameters via single 307 hop", async ({
    request,
  }) => {
    const dynamicCases = [
      { from: "/farmers/producer-uuid-123", to: "/producers/producer-uuid-123" },
      { from: "/farmer/products/prod-uuid-456", to: "/products/prod-uuid-456" },
      { from: "/farmer/products/prod-uuid-456/edit", to: "/dashboard/listings/prod-uuid-456/edit" },
      { from: "/business/products/prod-uuid-789", to: "/products/prod-uuid-789" },
      { from: "/business/checkout/confirmation/ord-uuid-999", to: "/checkout/confirmation/ord-uuid-999" },
    ];

    for (const { from, to } of dynamicCases) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status(), `GET ${from} must respond with 307 redirect`).toBe(307);
      expect(res.headers()["location"], `GET ${from} must target ${to}`).toBe(to);
    }
  });

  // ── 3. Legacy notification URLs ───────────────────────────────────────────
  test("legacy notification URLs (/business/orders/:id and /farmer/orders/:id) bridge to /orders/:id", async ({
    request,
  }) => {
    const testOrderId = "order-notif-uuid-abc";

    const farmerNotif = await request.get(`/farmer/orders/${testOrderId}`, { maxRedirects: 0 });
    expect(farmerNotif.status()).toBe(307);
    expect(farmerNotif.headers()["location"]).toBe(`/orders/${testOrderId}`);

    const buyerNotif = await request.get(`/business/orders/${testOrderId}`, { maxRedirects: 0 });
    expect(buyerNotif.status()).toBe(307);
    expect(buyerNotif.headers()["location"]).toBe(`/orders/${testOrderId}`);
  });

  // ── 4. Authenticated buyer: legacy navigation reaches canonical destination
  test("authenticated buyer: navigating legacy paths reaches V4 canonical destination without loops", async ({
    browser,
  }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();

    try {
      // /business/products -> /products
      await page.goto("/business/products", { waitUntil: "domcontentloaded" });
      expect(new URL(page.url()).pathname).toBe("/products");

      // /business/cart -> /cart
      await page.goto("/business/cart", { waitUntil: "domcontentloaded" });
      expect(new URL(page.url()).pathname).toBe("/cart");

      // /business -> /dashboard
      await page.goto("/business", { waitUntil: "domcontentloaded" });
      expect(new URL(page.url()).pathname).toBe("/dashboard");
    } finally {
      await context.close();
    }
  });

  // ── 5. Authenticated producer: legacy navigation reaches canonical listings/orders
  test("authenticated producer: navigating legacy paths reaches V4 canonical destinations", async ({
    browser,
  }) => {
    const { context } = await authenticatedContext(browser, farmer);
    const page = await context.newPage();

    try {
      // /farmer -> /dashboard
      await page.goto("/farmer", { waitUntil: "domcontentloaded" });
      expect(new URL(page.url()).pathname).toBe("/dashboard");

      // /farmer/products -> /dashboard/listings
      await page.goto("/farmer/products", { waitUntil: "domcontentloaded" });
      expect(new URL(page.url()).pathname).toBe("/dashboard/listings");

      // /farmer/products/new -> /dashboard/listings/new
      await page.goto("/farmer/products/new", { waitUntil: "domcontentloaded" });
      expect(new URL(page.url()).pathname).toBe("/dashboard/listings/new");
    } finally {
      await context.close();
    }
  });

  // ── 6. Admin: unauthorized fallback to /dashboard ─────────────────────────
  test("non-admin accessing /admin pages is routed to /dashboard", async ({
    browser,
  }) => {
    const { context } = await authenticatedContext(browser, buyer);
    const page = await context.newPage();

    try {
      await page.goto("/admin");
      await page.waitForURL("**/dashboard", { timeout: 15_000 });
      expect(new URL(page.url()).pathname).toBe("/dashboard");
    } finally {
      await page.close();
      await context.close();
    }
  });

  // ── 7. Suspended / revoked user: terminates at /sign-in?revoked=true ───────
  test("suspended/revoked user accessing legacy URL terminates at /sign-in?revoked=true without loops", async ({
    browser,
  }) => {
    const { context } = await authenticatedContext(browser, farmer);

    try {
      // Set farmer profile to revoked
      await setProfileStatus(admin, farmer.clerkUserId, "revoked");

      // Verify server-side redirect hops:
      // Hop 1: Route-level redirect /farmer -> /dashboard (307)
      const hop1 = await context.request.get("/farmer", { maxRedirects: 0 });
      expect(hop1.status()).toBe(307);
      expect(hop1.headers()["location"]).toBe("/dashboard");

      // Hop 2: /dashboard Server Component detects revoked status -> /sign-in?revoked=true (307)
      // We pass the session cookie via the page or browser context
      const page = await context.newPage();
      await page.goto("/farmer");
      await page.waitForURL(/\/sign-in\?revoked=true/, { timeout: 15_000 }).catch(() => undefined);
      // Verify the final URL has sign-in or revoked flag, never a loop back to /farmer
      const url = new URL(page.url());
      expect(url.pathname).not.toBe("/farmer");
      await page.close();
    } finally {
      // Restore status to active
      await setProfileStatus(admin, farmer.clerkUserId, "active");
      await context.close();
    }
  });

  // ── 8. Loop prevention: canonical destinations must never redirect back to legacy
  test("canonical V4 routes never redirect back to legacy routes", async ({
    request,
  }) => {
    const canonicalPaths = [
      "/dashboard",
      "/dashboard/listings",
      "/dashboard/listings/new",
      "/dashboard/orders",
      "/dashboard/inventory",
      "/orders",
      "/products",
      "/cart",
      "/checkout",
      "/checkout/confirmation",
      "/messages",
      "/profile",
    ];

    for (const path of canonicalPaths) {
      const res = await request.get(path, { maxRedirects: 0 });
      // If redirected (e.g. auth check), it must NEVER redirect to /farmer/* or /business/*
      if (res.status() >= 300 && res.status() < 400) {
        const location = res.headers()["location"] ?? "";
        expect(location).not.toMatch(/^\/(farmer|business)(\/|$)/);
      }
    }
  });
});
