/**
 * UMA Platform — Authentication & Authorization Helpers
 *
 * Central helpers that replace the repeated inline auth boilerplate
 * in every server action. Each helper throws an AppError on failure
 * so the action wrapper can classify and surface a safe message.
 *
 * These helpers are for SERVER use only (Server Actions, Route Handlers,
 * Server Components).
 *
 * Usage in a server action:
 *   const user = await requireUser();            // signed in
 *   const user = await requireRole("farmer");    // signed in + role
 *   const user = await requireActiveUser();      // signed in + active profile
 *   const user = await requireActiveRole("business"); // all three
 */

import { auth } from "@clerk/nextjs/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/platform/errors";
import type { UserRole } from "@/lib/constants";
import type { Profile } from "@/lib/types";

// ── Return type ────────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  /** Clerk user id (the `sub` claim in the Supabase JWT). */
  userId: string;
  /** Role from Clerk session claims: "farmer" | "business" | "admin". */
  role: UserRole;
  /** Raw Clerk session claims for advanced use. */
  sessionClaims: Record<string, unknown>;
}

export interface ActiveUser extends AuthenticatedUser {
  /** The user's profile row, guaranteed to exist and be active. */
  profile: Profile;
}

// ── requireUser ────────────────────────────────────────────────────────────────

/**
 * Requires a signed-in Clerk session.
 * Throws UNAUTHENTICATED if no session.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    throw new AppError("UNAUTHENTICATED");
  }

  const role = (sessionClaims?.user_role as UserRole | undefined) ?? null;
  if (!role) {
    throw new AppError("UNAUTHORIZED", "Account setup incomplete. Please complete onboarding.");
  }

  return {
    userId,
    role,
    sessionClaims: sessionClaims as Record<string, unknown>,
  };
}

// ── requireRole ────────────────────────────────────────────────────────────────

/**
 * Requires a signed-in user with a specific role.
 * Throws UNAUTHORIZED if the role doesn't match.
 */
export async function requireRole(expected: UserRole | UserRole[]): Promise<AuthenticatedUser> {
  const user = await requireUser();
  const allowed = Array.isArray(expected) ? expected : [expected];

  if (!allowed.includes(user.role)) {
    throw new AppError("UNAUTHORIZED");
  }

  return user;
}

// ── getProfile (internal, cached) ──────────────────────────────────────────────

/**
 * Fetch the profile for a clerk_id using the user's own RLS-scoped client.
 * Cached per request via React cache() to avoid duplicate DB calls when
 * both a layout and a page call requireActiveUser().
 */
const getProfileForUser = cache(async (clerkId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error) {
    // Log but don't leak DB errors. The caller will handle null.
    console.error("[platform/auth] profile fetch error:", error.message);
    return null;
  }

  return data as Profile | null;
});

// ── requireActiveUser ──────────────────────────────────────────────────────────

/**
 * Requires a signed-in user with an active profile.
 * Throws ACCOUNT_INACTIVE if the profile is missing or not active.
 */
export async function requireActiveUser(): Promise<ActiveUser> {
  const user = await requireUser();
  const profile = await getProfileForUser(user.userId);

  if (!profile) {
    throw new AppError("ACCOUNT_INACTIVE", "Profile not found. Please complete onboarding.");
  }

  if (profile.status && profile.status !== "active") {
    throw new AppError("ACCOUNT_INACTIVE", `Account is ${profile.status}.`);
  }

  return { ...user, profile };
}

// ── requireActiveRole ──────────────────────────────────────────────────────────

/**
 * Convenience: signed-in + active profile + required role(s).
 * The most common guard for server actions.
 */
export async function requireActiveRole(expected: UserRole | UserRole[]): Promise<ActiveUser> {
  const user = await requireActiveUser();
  const allowed = Array.isArray(expected) ? expected : [expected];

  if (!allowed.includes(user.role)) {
    throw new AppError("UNAUTHORIZED");
  }

  return user;
}
