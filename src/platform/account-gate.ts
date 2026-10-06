/**
 * UMA Platform — Account-status route gate (SEC-AUTH-001)
 *
 * Denies a signed-in user whose profiles.status is not 'active' (revoked or
 * suspended, set by the Clerk webhook or an admin) with a real HTTP 307 to
 * the revocation sign-in screen.
 *
 * Call it from a segment `layout.tsx`, never from a page: `loading.tsx` wraps
 * the page (not the same segment's layout) in a Suspense boundary, and once
 * that boundary streams, `redirect()` can only emit an in-page meta refresh
 * with a 200 status. The layout renders before the shell flushes, so the
 * redirect is still a real response status there.
 *
 * Deliberately narrow:
 * - unauthenticated requests pass through to the route's own sign-in flow;
 * - a missing profile passes through to the route's own onboarding flow;
 * - business resolution stays with the page (requireActiveBusiness()), which
 *   shares this request's cached profile read.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getProfileForUser } from "@/platform/auth";
import { routes } from "@/platform/routes";

export const REVOKED_SIGN_IN_URL = `${routes.signIn}?revoked=true`;

export async function redirectIfAccountInactive(): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;

  const profile = await getProfileForUser(userId);
  if (profile?.status && profile.status !== "active") {
    redirect(REVOKED_SIGN_IN_URL);
  }
}
