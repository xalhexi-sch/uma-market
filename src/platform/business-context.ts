/**
 * UMA Platform — Business Context & Authorization Helpers (V4)
 *
 * Centralizes multi-business resolution, active business context,
 * OWNER/STAFF membership checks, and BUY/SELL capability enforcement.
 *
 * All business resolution is strictly server-side and RLS-backed.
 * Client-provided business IDs are NEVER trusted without validating
 * membership against public.business_members.
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/platform/errors";
import { requireActiveUser } from "@/platform/auth";
import type { ActiveUser } from "@/platform/auth";
import type {
  Business,
  BusinessMember,
  BusinessRole,
  BusinessStatus,
} from "@/lib/types";

export const ACTIVE_BUSINESS_COOKIE = "uma_active_business_id";

// ── Active Business Context ──────────────────────────────────────────────────

export interface ActiveBusinessContext {
  /** The authenticated and active user. */
  user: ActiveUser;
  /** The currently active business. */
  business: Business;
  /** The user's role in this active business: OWNER or STAFF. */
  role: BusinessRole;
  /** Whether the active business has buying capability. */
  canBuy: boolean;
  /** Whether the active business has selling capability. */
  canSell: boolean;
  /** Convenience: role === "OWNER" */
  isOwner: boolean;
  /** Convenience: role === "STAFF" */
  isStaff: boolean;
  /** All businesses the user is currently a member of. */
  memberships: BusinessMember[];
}

// ── Cookie Helpers ───────────────────────────────────────────────────────────

/**
 * Reads the active business ID from cookies.
 * Fails safely (returns null) outside request context or when no cookie is set.
 */
export async function getActiveBusinessCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Sets the active business ID in cookies.
 * Safe for server actions and route handlers.
 */
export async function setActiveBusinessCookie(businessId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

// ── Membership Query ─────────────────────────────────────────────────────────

/**
 * Fetches all active business memberships for a user.
 */
export async function getUserBusinessMemberships(clerkId: string): Promise<BusinessMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_members")
    .select(`
      id, business_id, user_id, role, created_at, updated_at,
      business:businesses(
        id, name, can_buy, can_sell, status, legacy_clerk_id, created_at, updated_at
      )
    `)
    .eq("user_id", clerkId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[platform/business-context] fetch memberships error:", error.message);
    return [];
  }

  return (data ?? [])
    .filter((row): row is typeof row & { business: NonNullable<typeof row.business> } =>
      Boolean(row.business && row.business.status === "active")
    )
    .map((row) => ({
      id: row.id,
      business_id: row.business_id,
      user_id: row.user_id,
      role: row.role as BusinessRole,
      created_at: row.created_at,
      updated_at: row.updated_at,
      business: {
        id: row.business.id,
        name: row.business.name,
        can_buy: Boolean(row.business.can_buy),
        can_sell: Boolean(row.business.can_sell),
        status: row.business.status as BusinessStatus,
        legacy_clerk_id: row.business.legacy_clerk_id,
        created_at: row.business.created_at,
        updated_at: row.business.updated_at,
      },
    }));
}

// ── Context Resolution ───────────────────────────────────────────────────────

/**
 * Resolves the active business context for a given active user.
 *
 * Precedence:
 * 1. Explicit preferredBusinessId (if provided and user is a member).
 * 2. Active business cookie (if set and user is a member).
 * 3. Default to user's primary/first business (preferring OWNER role).
 *
 * Throws UNAUTHORIZED if the user has no business memberships or
 * if an explicitly requested businessId is not accessible to this user.
 */
export async function resolveActiveBusinessContext(
  user: ActiveUser,
  preferredBusinessId?: string | null
): Promise<ActiveBusinessContext> {
  const memberships = await getUserBusinessMemberships(user.userId);

  if (memberships.length === 0) {
    throw new AppError("UNAUTHORIZED", "No active business associated with this account.");
  }

  let selectedMembership: BusinessMember | undefined;

  // 1. Explicit preference
  if (preferredBusinessId) {
    selectedMembership = memberships.find((m) => m.business_id === preferredBusinessId);
    if (!selectedMembership) {
      throw new AppError("UNAUTHORIZED", "You do not have access to the specified business.");
    }
  }

  // 2. Cookie preference
  if (!selectedMembership) {
    const cookieBusinessId = await getActiveBusinessCookie();
    if (cookieBusinessId) {
      selectedMembership = memberships.find((m) => m.business_id === cookieBusinessId);
    }
  }

  // 3. Fallback: single business or default (prefer OWNER, else first)
  if (!selectedMembership) {
    selectedMembership = memberships.find((m) => m.role === "OWNER") ?? memberships[0];
  }

  const business = selectedMembership.business!;

  return {
    user,
    business,
    role: selectedMembership.role,
    canBuy: business.can_buy,
    canSell: business.can_sell,
    isOwner: selectedMembership.role === "OWNER",
    isStaff: selectedMembership.role === "STAFF",
    memberships,
  };
}

// ── Guards ───────────────────────────────────────────────────────────────────

export interface BusinessMembershipOption {
  id: string;
  name: string;
  role: BusinessRole;
  canBuy: boolean;
  canSell: boolean;
  isActive: boolean;
}

export interface ActiveBusinessIdentity {
  id?: string;
  name: string;
  role: BusinessRole;
  canBuy: boolean;
  canSell: boolean;
  memberships?: BusinessMembershipOption[];
}

/**
 * Safely resolves the active business context for the current user if signed in.
 * Returns null if unauthenticated, revoked, in onboarding, or having no active business.
 * Never throws, ensuring navigation and shell components fail safely without crashing.
 */
export async function getActiveBusinessContext(
  preferredBusinessId?: string | null
): Promise<ActiveBusinessContext | null> {
  try {
    return await requireActiveBusiness(preferredBusinessId);
  } catch {
    return null;
  }
}

/**
 * Safely resolves the minimal serialized identity of the active business,
 * including all available business memberships for switching.
 * Suitable for server components passing identity to navigation and sidebar headers.
 * Returns null if no active business is available.
 */
export async function getActiveBusinessIdentity(
  preferredBusinessId?: string | null
): Promise<ActiveBusinessIdentity | null> {
  const ctx = await getActiveBusinessContext(preferredBusinessId);
  if (!ctx) return null;
  return {
    id: ctx.business.id,
    name: ctx.business.name,
    role: ctx.role,
    canBuy: ctx.canBuy,
    canSell: ctx.canSell,
    memberships: ctx.memberships.map((m) => ({
      id: m.business_id,
      name: m.business?.name ?? "Business",
      role: m.role,
      canBuy: Boolean(m.business?.can_buy),
      canSell: Boolean(m.business?.can_sell),
      isActive: m.business_id === ctx.business.id,
    })),
  };
}

/**
 * Requires a signed-in active user and resolves their active business context.
 */
export async function requireActiveBusiness(
  preferredBusinessId?: string | null
): Promise<ActiveBusinessContext> {
  const user = await requireActiveUser();
  return resolveActiveBusinessContext(user, preferredBusinessId);
}

/**
 * Requires that the authenticated user is an active member (OWNER or STAFF)
 * of the specified business.
 *
 * Throws UNAUTHORIZED if the user is not a member of this business.
 */
export async function requireBusinessMembership(
  businessId: string
): Promise<ActiveBusinessContext> {
  if (!businessId) {
    throw new AppError("VALIDATION", "Business ID is required.");
  }
  const user = await requireActiveUser();
  return resolveActiveBusinessContext(user, businessId);
}

/**
 * Requires that the user has a specific role (e.g. OWNER) in their active business.
 */
export async function requireBusinessRole(
  expectedRole: BusinessRole | BusinessRole[],
  businessId?: string | null
): Promise<ActiveBusinessContext> {
  const context = await requireActiveBusiness(businessId);
  const allowed = Array.isArray(expectedRole) ? expectedRole : [expectedRole];

  if (!allowed.includes(context.role)) {
    throw new AppError("UNAUTHORIZED", "Insufficient business permissions for this action.");
  }

  return context;
}

/**
 * Requires that the user has active membership in a business with BUY capability.
 * Both OWNER and STAFF of a buying business pass this check.
 *
 * Throws UNAUTHORIZED if the business cannot buy.
 */
export async function requireCanBuy(
  businessId?: string | null
): Promise<ActiveBusinessContext> {
  const context = await requireActiveBusiness(businessId);

  if (!context.canBuy) {
    throw new AppError("UNAUTHORIZED", "This business does not have buying capability.");
  }

  return context;
}

/**
 * Requires that the user has active membership in a business with SELL capability.
 * Both OWNER and STAFF of a selling business pass this check.
 *
 * Throws UNAUTHORIZED if the business cannot sell.
 */
export async function requireCanSell(
  businessId?: string | null
): Promise<ActiveBusinessContext> {
  const context = await requireActiveBusiness(businessId);

  if (!context.canSell) {
    throw new AppError("UNAUTHORIZED", "This business does not have selling capability.");
  }

  return context;
}

/**
 * Server action to switch the active business.
 * Verifies membership before writing the cookie.
 */
export async function switchActiveBusiness(
  businessId: string
): Promise<{ success: boolean; businessId: string }> {
  await requireBusinessMembership(businessId);
  await setActiveBusinessCookie(businessId);
  return { success: true, businessId };
}
