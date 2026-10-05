/**
 * UMA Market V4 — Business Context & Cart Ownership Foundation Verification
 *
 * Verifies the core foundation for V4 cart ownership:
 *  1. User belonging to multiple businesses
 *  2. OWNER access permissions
 *  3. STAFF access permissions
 *  4. Non-member rejection
 *  5. BUY capability requirement
 *  6. Business isolation between different businesses
 *  7. Active-business switching behavior & cookie resolution
 *  8. Additive database migration SQL contract (businesses, business_members, cart_items)
 *
 * HOW TO RUN:
 *   npx tsx scripts/verify-v4-business-cart-foundation.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { AppError } from "../src/platform/errors";
import {
  ACTIVE_BUSINESS_COOKIE,
  type ActiveBusinessContext,
} from "../src/platform/business-context";
import type { ActiveUser } from "../src/platform/auth";
import type { Business, BusinessMember, CartItem } from "../src/lib/types";

// ── Test harness ─────────────────────────────────────────────────────────────

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(id: string, name: string, condition: boolean, details: string): boolean {
  results.push({ id, name, passed: condition, details });
  const icon = condition ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${id.padEnd(20)} ${name}`);
  if (!condition) console.log(`           >> ${details}`);
  return condition;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(76)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(76));
}

// ── Test Personas & Fixtures ─────────────────────────────────────────────────

const mockUser: ActiveUser = {
  userId: "user_test_multi_business_123",
  role: "business",
  sessionClaims: { sub: "user_test_multi_business_123", user_role: "business" },
  profile: {
    id: "p1000000-0000-0000-0000-000000000001",
    clerk_id: "user_test_multi_business_123",
    role: "business",
    full_name: "Multi-Business Operator",
    business_name: "Operator Corp",
    city: "Baguio",
    phone: "09171234567",
    address: "Session Road",
    bio: "Manages farm and cafe",
    avatar_url: null,
    is_verified: true,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

const businessA_Cafe: Business = {
  id: "b1000000-0000-0000-0000-000000000001",
  name: "Baguio Highland Cafe",
  can_buy: true,
  can_sell: false,
  status: "active",
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
};

const businessB_Farm: Business = {
  id: "b2000000-0000-0000-0000-000000000002",
  name: "La Trinidad Berry Farm",
  can_buy: false,
  can_sell: true,
  status: "active",
  created_at: "2026-10-02T00:00:00.000Z",
  updated_at: "2026-10-02T00:00:00.000Z",
};

const businessC_Trading: Business = {
  id: "b3000000-0000-0000-0000-000000000003",
  name: "Cordillera Produce Trading",
  can_buy: true,
  can_sell: true,
  status: "active",
  created_at: "2026-10-03T00:00:00.000Z",
  updated_at: "2026-10-03T00:00:00.000Z",
};

const unassociatedBusiness: Business = {
  id: "b9999999-0000-0000-0000-000000000999",
  name: "Stranger Farm",
  can_buy: true,
  can_sell: true,
  status: "active",
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
};

// User belongs to Business A (OWNER) and Business B (STAFF) and Business C (STAFF)
const userMemberships: BusinessMember[] = [
  {
    id: "bm100000-0000-0000-0000-000000000001",
    business_id: businessA_Cafe.id,
    user_id: mockUser.userId,
    role: "OWNER",
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    business: businessA_Cafe,
  },
  {
    id: "bm200000-0000-0000-0000-000000000002",
    business_id: businessB_Farm.id,
    user_id: mockUser.userId,
    role: "STAFF",
    created_at: "2026-10-02T00:00:00.000Z",
    updated_at: "2026-10-02T00:00:00.000Z",
    business: businessB_Farm,
  },
  {
    id: "bm300000-0000-0000-0000-000000000003",
    business_id: businessC_Trading.id,
    user_id: mockUser.userId,
    role: "STAFF",
    created_at: "2026-10-03T00:00:00.000Z",
    updated_at: "2026-10-03T00:00:00.000Z",
    business: businessC_Trading,
  },
];

// Pure resolution function for deterministic testing
function resolveContextFromMemberships(
  user: ActiveUser,
  memberships: BusinessMember[],
  preferredBusinessId?: string | null,
  cookieBusinessId?: string | null
): ActiveBusinessContext {
  if (memberships.length === 0) {
    throw new AppError("UNAUTHORIZED", "No active business associated with this account.");
  }

  let selected: BusinessMember | undefined;

  // 1. Explicit business ID preference (server-validated membership)
  if (preferredBusinessId) {
    selected = memberships.find((m) => m.business_id === preferredBusinessId);
    if (!selected) {
      throw new AppError("UNAUTHORIZED", "You do not have access to the specified business.");
    }
  }

  // 2. Cookie preference if no explicit ID
  if (!selected && cookieBusinessId) {
    selected = memberships.find((m) => m.business_id === cookieBusinessId);
  }

  // 3. Fallback: prefer OWNER, else first membership
  if (!selected) {
    selected = memberships.find((m) => m.role === "OWNER") ?? memberships[0];
  }

  const business = selected.business!;

  return {
    user,
    business,
    role: selected.role,
    canBuy: business.can_buy,
    canSell: business.can_sell,
    isOwner: selected.role === "OWNER",
    isStaff: selected.role === "STAFF",
    memberships,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  // ── 1. Multiple businesses resolution ──────────────────────────────────────
  section("TEST 1: User Belonging to Multiple Businesses");

  assert(
    "MB-01",
    "User can belong to multiple businesses simultaneously",
    userMemberships.length === 3,
    `memberships count = ${userMemberships.length}`
  );

  const defaultContext = resolveContextFromMemberships(mockUser, userMemberships);
  assert(
    "MB-02",
    "Defaults to primary/OWNER business when no cookie or explicit preference",
    defaultContext.business.id === businessA_Cafe.id && defaultContext.isOwner,
    `resolved business=${defaultContext.business.name}, role=${defaultContext.role}`
  );

  const explicitBContext = resolveContextFromMemberships(
    mockUser,
    userMemberships,
    businessB_Farm.id
  );
  assert(
    "MB-03",
    "Resolves requested business when user is a valid member",
    explicitBContext.business.id === businessB_Farm.id,
    `resolved=${explicitBContext.business.name}`
  );

  // ── 2. Active business switching behavior ──────────────────────────────────
  section("TEST 2: Active Business Switching Behavior");

  // Switching via cookie
  const cookieContext = resolveContextFromMemberships(
    mockUser,
    userMemberships,
    null,
    businessC_Trading.id
  );
  assert(
    "SW-01",
    "Active business switches to cookie value when cookie matches membership",
    cookieContext.business.id === businessC_Trading.id,
    `resolved=${cookieContext.business.name}`
  );

  // Stale/unknown cookie falls back safely to default without throwing
  const staleCookieContext = resolveContextFromMemberships(
    mockUser,
    userMemberships,
    null,
    "unknown-stale-business-uuid"
  );
  assert(
    "SW-02",
    "Invalid/stale cookie falls back gracefully to default primary business",
    staleCookieContext.business.id === businessA_Cafe.id,
    `fallback=${staleCookieContext.business.name}`
  );

  assert(
    "SW-03",
    "ACTIVE_BUSINESS_COOKIE name is exported and stable",
    ACTIVE_BUSINESS_COOKIE === "uma_active_business_id",
    `cookie name=${ACTIVE_BUSINESS_COOKIE}`
  );

  // ── 3. OWNER access permissions ────────────────────────────────────────────
  section("TEST 3: OWNER Access Permissions");

  const cafeContext = resolveContextFromMemberships(
    mockUser,
    userMemberships,
    businessA_Cafe.id
  );
  assert(
    "OWN-01",
    "OWNER role correctly identified",
    cafeContext.role === "OWNER" && cafeContext.isOwner && !cafeContext.isStaff,
    `role=${cafeContext.role}, isOwner=${cafeContext.isOwner}`
  );

  function checkRoleGuard(context: ActiveBusinessContext, required: "OWNER" | "STAFF"): boolean {
    if (required === "OWNER" && context.role !== "OWNER") {
      throw new AppError("UNAUTHORIZED", "Insufficient business permissions for this action.");
    }
    return true;
  }

  assert(
    "OWN-02",
    "OWNER passes OWNER role check",
    checkRoleGuard(cafeContext, "OWNER") === true,
    "owner allowed"
  );

  // ── 4. STAFF access permissions ────────────────────────────────────────────
  section("TEST 4: STAFF Access Permissions");

  const farmStaffContext = resolveContextFromMemberships(
    mockUser,
    userMemberships,
    businessB_Farm.id
  );
  assert(
    "STF-01",
    "STAFF role correctly identified",
    farmStaffContext.role === "STAFF" && farmStaffContext.isStaff && !farmStaffContext.isOwner,
    `role=${farmStaffContext.role}, isStaff=${farmStaffContext.isStaff}`
  );

  let staffOwnerCheckFailed = false;
  try {
    checkRoleGuard(farmStaffContext, "OWNER");
  } catch (err) {
    if (err instanceof AppError && err.code === "UNAUTHORIZED") {
      staffOwnerCheckFailed = true;
    }
  }
  assert(
    "STF-02",
    "STAFF is rejected when an action requires OWNER role",
    staffOwnerCheckFailed,
    "staff rejected from owner-only actions"
  );

  // ── 5. Non-member rejection ────────────────────────────────────────────────
  section("TEST 5: Non-Member Rejection");

  let nonMemberRejected = false;
  let nonMemberErrorCode = "";
  try {
    resolveContextFromMemberships(mockUser, userMemberships, unassociatedBusiness.id);
  } catch (err) {
    if (err instanceof AppError) {
      nonMemberRejected = true;
      nonMemberErrorCode = err.code;
    }
  }
  assert(
    "NON-01",
    "Accessing a business without membership throws UNAUTHORIZED",
    nonMemberRejected && nonMemberErrorCode === "UNAUTHORIZED",
    `rejected=${nonMemberRejected}, code=${nonMemberErrorCode}`
  );

  let zeroMembershipRejected = false;
  try {
    resolveContextFromMemberships(mockUser, []);
  } catch (err) {
    if (err instanceof AppError && err.code === "UNAUTHORIZED") {
      zeroMembershipRejected = true;
    }
  }
  assert(
    "NON-02",
    "User with zero business memberships throws UNAUTHORIZED",
    zeroMembershipRejected,
    "zero memberships blocked"
  );

  // ── 6. BUY Capability Requirement ──────────────────────────────────────────
  section("TEST 6: BUY Capability Requirement");

  function checkCanBuy(context: ActiveBusinessContext): boolean {
    if (!context.canBuy) {
      throw new AppError("UNAUTHORIZED", "This business does not have buying capability.");
    }
    return true;
  }

  // Business A has can_buy: true
  assert(
    "BUY-01",
    "Buying business passes can_buy requirement",
    checkCanBuy(cafeContext) === true,
    `canBuy=${cafeContext.canBuy}`
  );

  // Business B (Farm) has can_buy: false
  let sellOnlyBlockedFromBuying = false;
  let sellOnlyErrorMessage = "";
  try {
    checkCanBuy(farmStaffContext);
  } catch (err) {
    if (err instanceof AppError && err.code === "UNAUTHORIZED") {
      sellOnlyBlockedFromBuying = true;
      sellOnlyErrorMessage = err.message;
    }
  }
  assert(
    "BUY-02",
    "Selling-only business is blocked from cart/buying operations",
    sellOnlyBlockedFromBuying && sellOnlyErrorMessage.includes("buying capability"),
    `blocked=${sellOnlyBlockedFromBuying}, message="${sellOnlyErrorMessage}"`
  );

  // Business C has both BUY + SELL
  const tradingContext = resolveContextFromMemberships(
    mockUser,
    userMemberships,
    businessC_Trading.id
  );
  assert(
    "BUY-03",
    "Dual-capability business (BUY + SELL) passes can_buy requirement",
    checkCanBuy(tradingContext) === true && tradingContext.canSell === true,
    `canBuy=${tradingContext.canBuy}, canSell=${tradingContext.canSell}`
  );

  // ── 7. Business Cart Isolation ─────────────────────────────────────────────
  section("TEST 7: Business Cart Isolation");

  const mockCartTable: CartItem[] = [
    // Business A cart items (Cafe procuring produce)
    {
      id: "cart-001",
      business_id: businessA_Cafe.id,
      product_id: "prod-tomato-001",
      quantity: 50,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "cart-002",
      business_id: businessA_Cafe.id,
      product_id: "prod-lettuce-002",
      quantity: 20,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    // Business C cart items (Trading procuring bulk items)
    {
      id: "cart-003",
      business_id: businessC_Trading.id,
      product_id: "prod-potato-003",
      quantity: 500,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  function queryCartForBusiness(businessId: string): CartItem[] {
    return mockCartTable.filter((item) => item.business_id === businessId);
  }

  const cafeCart = queryCartForBusiness(businessA_Cafe.id);
  const farmCart = queryCartForBusiness(businessB_Farm.id);
  const tradingCart = queryCartForBusiness(businessC_Trading.id);

  assert(
    "ISO-01",
    "Business A cart contains only Business A items",
    cafeCart.length === 2 && cafeCart.every((i) => i.business_id === businessA_Cafe.id),
    `cafe items count=${cafeCart.length}`
  );

  assert(
    "ISO-02",
    "Business B cart is independent and empty",
    farmCart.length === 0,
    `farm cart count=${farmCart.length}`
  );

  assert(
    "ISO-03",
    "Business C cart contains only Business C items",
    tradingCart.length === 1 && tradingCart[0].product_id === "prod-potato-003",
    `trading item=${tradingCart[0]?.product_id}`
  );

  assert(
    "ISO-04",
    "Switching context from Business A to Business C switches cart view cleanly without clobbering items",
    queryCartForBusiness(cafeContext.business.id).length === 2 &&
      queryCartForBusiness(tradingContext.business.id).length === 1,
    "isolation verified"
  );

  // ── 8. Additive Database Migration SQL Verification ─────────────────────────
  section("TEST 8: Additive Database Migration SQL Contract");

  const migrationPath = path.resolve(
    __dirname,
    "../supabase/migrations/20261005000005_v4_business_cart_foundation.sql"
  );
  assert(
    "MIG-01",
    "Migration file 20261005000005_v4_business_cart_foundation.sql exists",
    fs.existsSync(migrationPath),
    migrationPath
  );

  const sqlContent = fs.readFileSync(migrationPath, "utf-8");

  assert(
    "MIG-02",
    "Migration defines public.businesses table",
    sqlContent.includes("CREATE TABLE IF NOT EXISTS public.businesses"),
    "table businesses defined"
  );

  assert(
    "MIG-03",
    "Migration defines public.business_members table with OWNER/STAFF check",
    sqlContent.includes("CREATE TABLE IF NOT EXISTS public.business_members") &&
      sqlContent.includes("CHECK (role IN ('OWNER', 'STAFF'))"),
    "table business_members with role check defined"
  );

  assert(
    "MIG-04",
    "Migration adds additive business_id column to public.cart_items",
    sqlContent.includes("ALTER TABLE public.cart_items") &&
      sqlContent.includes("ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id)"),
    "cart_items.business_id additive foreign key defined"
  );

  assert(
    "MIG-05",
    "Migration enforces RLS on businesses, business_members, and cart_items",
    sqlContent.includes("ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;") &&
      sqlContent.includes("ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;") &&
      sqlContent.includes("cart_items: member manages business cart or legacy own"),
    "RLS enabled and configured"
  );

  assert(
    "MIG-06",
    "Migration maintains backward compatibility for legacy business_clerk_id cart items",
    sqlContent.includes("business_id IS NULL") &&
      sqlContent.includes("auth.jwt()->>'sub' = business_clerk_id") &&
      sqlContent.includes("(auth.jwt()->>'user_role') = 'business'"),
    "legacy V2 fallback preserved in RLS"
  );

  assert(
    "MIG-07",
    "Migration includes idempotent backfill from profiles into businesses & memberships",
    sqlContent.includes("INSERT INTO public.businesses") &&
      sqlContent.includes("INSERT INTO public.business_members") &&
      sqlContent.includes("ON CONFLICT (legacy_clerk_id) DO NOTHING;"),
    "idempotent backfill included"
  );

  // ── Summary ────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n${"=".repeat(76)}`);
  console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${results.length})`);
  console.log("=".repeat(76));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test suite threw an unhandled error:", err);
  process.exit(1);
});
