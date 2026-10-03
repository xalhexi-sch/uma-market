// =============================================================================
// UMA Market — AUTHZ-10: onboarding role escalation (browser security test)
//
// Threat model (docs/security/UMA-SECURITY-RESILIENCE-PLAN.md, AUTHZ-10):
// an authenticated user manipulates the onboarding form submission payload to
// send `role = "admin"` to the real `completeOnboarding` server action.
//
// This spec drives the GENUINE flow: a real Clerk session against the isolated
// security-test environment, the real /onboarding page, and the real server
// action. The tampering is performed by rewriting the outgoing
// server-action request in flight — an attacker-style payload, not a mock.
//
// Expected matrix:
//   1. role=admin            -> REJECTED, no profile row, no metadata role
//   2. role=farmer (retry)   -> allowed
//   3. role=business         -> allowed
//
// SAFETY: credentials come exclusively from .env.security-test.local via the
// shared harness (fail-closed project-ref guard). Synthetic users are created
// in the Clerk Development instance and deleted in cleanup. Production is
// never contacted.
// =============================================================================

import { expect, test } from "@playwright/test";
import {
  authenticatedContext,
  createSyntheticUser,
  deleteClerkUser,
  getPublicMetadata,
  revokeSession,
  serviceClient,
} from "./harness";

const REJECTED_ERROR = "Choose a valid farmer or business role to continue.";

/** Field names only — never log values (they may carry future secrets). */
function fieldNames(body: string): string[] {
  return [...body.matchAll(/name="([^"]+)"/g)].map((match) => match[1]);
}

test.describe("AUTHZ-10 — onboarding role escalation", () => {
  test("role=admin is rejected; farmer and business remain allowed", async ({ browser }) => {
    const supabaseAdmin = serviceClient();
    const syntheticUserIds: string[] = [];
    const sessionIds: string[] = [];
    const contexts: Array<Awaited<ReturnType<typeof authenticatedContext>>["context"]> = [];

    const cleanup = async (): Promise<void> => {
      // Profile rows first (while the users still exist for id clarity), then
      // sessions, then the synthetic users themselves.
      if (syntheticUserIds.length > 0) {
        const { error } = await supabaseAdmin.from("profiles").delete().in("clerk_id", syntheticUserIds);
        if (error) throw new Error(`cleanup: profile delete failed: ${error.message}`);
      }
      for (const sessionId of sessionIds) {
        await revokeSession(sessionId).catch(() => undefined);
      }
      for (const context of contexts) {
        await context.close().catch(() => undefined);
      }
      for (const userId of syntheticUserIds) {
        await deleteClerkUser(userId);
      }
      syntheticUserIds.length = 0;
      sessionIds.length = 0;
      contexts.length = 0;
    };

    try {
      // -----------------------------------------------------------------
      // Case 1 — tampered payload: role = "admin" (fresh, role-less user)
      // -----------------------------------------------------------------
      const attacker = await createSyntheticUser("authz10-escalation");
      syntheticUserIds.push(attacker.clerkUserId);

      const attackerSession = await authenticatedContext(browser, attacker);
      sessionIds.push(attackerSession.sessionId);
      contexts.push(attackerSession.context);

      const page = await attackerSession.context.newPage();

      let tamperApplied = false;
      let submittedFieldNames: string[] = [];
      await page.route("**/onboarding", async (route) => {
        const request = route.request();
        if (request.method() !== "POST") return route.continue();

        const original = (await request.postDataBuffer())?.toString("utf8") ?? "";
        submittedFieldNames = fieldNames(original);
        // Rewrite the submitted role value in flight. "farmer" appears only
        // as the selected role value in this payload (verified by the
        // tamperApplied assertion below).
        const tampered = original.replace(/\bfarmer\b/g, "admin");
        tamperApplied = tampered !== original;

        const headers = { ...request.headers() };
        headers["content-length"] = String(Buffer.byteLength(tampered, "utf8"));
        return route.continue({ postData: tampered, headers });
      });

      await page.goto("/onboarding");
      await expect(
        page.getByRole("heading", { name: "How will you use UMA?" }),
        "fresh user must see the first-time role selection",
      ).toBeVisible();

      await page.locator("#role-farmer").check({ force: true });
      await page.getByRole("button", { name: "Continue" }).click();

      // The server action must reject the tampered payload.
      await expect(
        page.getByText(REJECTED_ERROR),
        `tamper fields: [${submittedFieldNames.join(", ")}]`,
      ).toBeVisible({ timeout: 30_000 });
      await page.unroute("**/onboarding");

      expect(tamperApplied, "interception must have rewritten role -> admin").toBe(true);

      // No profile row with role=admin, no Clerk metadata escalation.
      const { data: profileAfterTamper, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("clerk_id", attacker.clerkUserId)
        .maybeSingle();
      expect(profileError, profileError?.message ?? "").toBeNull();
      expect(profileAfterTamper, "no profile may exist after the rejected submission").toBeNull();

      const metadataAfterTamper = await getPublicMetadata(attacker.clerkUserId);
      expect(metadataAfterTamper.role, "publicMetadata.role must stay unset").toBeUndefined();

      // -----------------------------------------------------------------
      // Case 2 — legitimate retry on the same account: role = "farmer"
      // -----------------------------------------------------------------
      await page.locator("#role-farmer").check({ force: true });
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForURL(/\/(onboarding\/complete|farmer)/, { timeout: 30_000 });

      const { data: farmerProfile, error: farmerProfileError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("clerk_id", attacker.clerkUserId)
        .maybeSingle();
      expect(farmerProfileError, farmerProfileError?.message ?? "").toBeNull();
      expect(farmerProfile?.role, "valid farmer role must be accepted").toBe("farmer");

      const farmerMetadata = await getPublicMetadata(attacker.clerkUserId);
      expect(farmerMetadata.role, "metadata role must be farmer, never admin").toBe("farmer");

      // -----------------------------------------------------------------
      // Case 3 — legitimate first-time onboarding: role = "business"
      // -----------------------------------------------------------------
      const business = await createSyntheticUser("authz10-business");
      syntheticUserIds.push(business.clerkUserId);

      const businessSession = await authenticatedContext(browser, business);
      sessionIds.push(businessSession.sessionId);
      contexts.push(businessSession.context);

      const businessPage = await businessSession.context.newPage();
      await businessPage.goto("/onboarding");
      await expect(
        businessPage.getByRole("heading", { name: "How will you use UMA?" }),
      ).toBeVisible();

      await businessPage.locator("#role-business").check({ force: true });
      await businessPage.getByRole("button", { name: "Continue" }).click();
      await businessPage.waitForURL(/\/(onboarding\/complete|business)/, { timeout: 30_000 });

      const { data: businessProfile, error: businessProfileError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("clerk_id", business.clerkUserId)
        .maybeSingle();
      expect(businessProfileError, businessProfileError?.message ?? "").toBeNull();
      expect(businessProfile?.role, "valid business role must be accepted").toBe("business");

      const businessMetadata = await getPublicMetadata(business.clerkUserId);
      expect(businessMetadata.role).toBe("business");
    } finally {
      await cleanup();
    }
  });
});
