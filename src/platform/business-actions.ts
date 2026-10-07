"use server";

/**
 * UMA Platform — V4 Business Actions
 *
 * Implements server actions for:
 * 1. Switching the active business (with server-side membership validation)
 * 2. Creating another business (with OWNER role assignment and active-cookie set)
 */

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/platform/auth";
import {
  requireBusinessMembership,
  requireBusinessRole,
  setActiveBusinessCookie,
} from "@/platform/business-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeErrorMessage } from "@/platform/errors";

export interface CreateBusinessInput {
  name: string;
  capability: "sell" | "buy" | "both";
}

export interface UpdateBusinessSettingsInput {
  businessId?: string;
  name: string;
  capability: "sell" | "buy" | "both";
}

export interface BusinessActionResult {
  success: boolean;
  businessId?: string;
  businessName?: string;
  error?: string;
}

/**
 * Switches the authenticated user's active business.
 * Validates membership server-side before writing the cookie.
 * Client selection is NEVER the authorization boundary.
 */
export async function switchBusinessAction(businessId: string): Promise<BusinessActionResult> {
  try {
    if (!businessId || typeof businessId !== "string") {
      return { success: false, error: "Invalid business ID." };
    }

    // Server-side boundary: strictly verifies active user belongs to this business
    await requireBusinessMembership(businessId);
    await setActiveBusinessCookie(businessId);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/listings");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/orders");
    revalidatePath("/cart");
    revalidatePath("/orders");
    revalidatePath("/profile");
    revalidatePath("/products");

    return { success: true, businessId };
  } catch (err: unknown) {
    console.error("[switchBusinessAction] error:", err);
    return { success: false, error: safeErrorMessage(err) };
  }
}

/**
 * Provisions an additional business for the authenticated active user.
 * Assigns OWNER membership and sets the new business as active.
 */
export async function createBusinessAction(
  input: CreateBusinessInput
): Promise<BusinessActionResult> {
  try {
    const user = await requireActiveUser();

    const trimmedName = typeof input?.name === "string" ? input.name.trim() : "";
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, error: "Business name must be at least 2 characters." };
    }
    if (trimmedName.length > 100) {
      return { success: false, error: "Business name cannot exceed 100 characters." };
    }

    const canBuy = input.capability === "buy" || input.capability === "both";
    const canSell = input.capability === "sell" || input.capability === "both";
    if (!canBuy && !canSell) {
      return { success: false, error: "Please select how you will use UMA (Sell, Buy, or Both)." };
    }

    const admin = createAdminClient();

    // 1. Provision new business
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: business, error: bizError } = await (admin as any)
      .from("businesses")
      .insert({
        name: trimmedName,
        can_buy: canBuy,
        can_sell: canSell,
        status: "active",
      })
      .select("id, name, can_buy, can_sell")
      .single();

    if (bizError || !business) {
      console.error("[createBusinessAction] failed to insert business:", bizError?.message);
      return { success: false, error: "Failed to create business. Please try again." };
    }

    // 2. Establish OWNER membership for the user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: memberError } = await (admin as any)
      .from("business_members")
      .insert({
        business_id: business.id,
        user_id: user.userId,
        role: "OWNER",
      });

    if (memberError) {
      console.error("[createBusinessAction] failed to create owner membership:", memberError.message);
      // Clean up orphaned business row
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("businesses").delete().eq("id", business.id);
      return { success: false, error: "Failed to establish business ownership. Please try again." };
    }

    // 3. Make newly created business active immediately
    await setActiveBusinessCookie(business.id);

    // 4. Revalidate all relevant dashboard paths
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/listings");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/orders");
    revalidatePath("/cart");
    revalidatePath("/orders");
    revalidatePath("/profile");
    revalidatePath("/products");

    return {
      success: true,
      businessId: business.id,
      businessName: business.name,
    };
  } catch (err: unknown) {
    console.error("[createBusinessAction] error:", err);
    return { success: false, error: safeErrorMessage(err) };
  }
}

/**
 * Updates settings for the currently active business.
 * Validates that caller is the business OWNER server-side.
 * Strictly scopes modifications to the active business context.
 */
export async function updateBusinessSettingsAction(
  input: UpdateBusinessSettingsInput
): Promise<BusinessActionResult> {
  try {
    // 1. Server-side authorization: requires active business and OWNER role
    const context = await requireBusinessRole("OWNER");

    // 2. Active business scoping: ensure client-provided ID (if given) matches active business
    if (input.businessId && input.businessId !== context.business.id) {
      return {
        success: false,
        error: "Cross-business modification is not allowed.",
      };
    }

    // 3. Validate name
    const trimmedName = typeof input?.name === "string" ? input.name.trim() : "";
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, error: "Business name must be at least 2 characters." };
    }
    if (trimmedName.length > 100) {
      return { success: false, error: "Business name cannot exceed 100 characters." };
    }

    // 4. Validate capability
    const canBuy = input.capability === "buy" || input.capability === "both";
    const canSell = input.capability === "sell" || input.capability === "both";
    if (!canBuy && !canSell) {
      return { success: false, error: "Please select how you will use UMA (Sell, Buy, or Both)." };
    }

    // 5. Update business record via admin client (service_role is required per migration 20261009000000)
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (admin as any)
      .from("businesses")
      .update({
        name: trimmedName,
        can_buy: canBuy,
        can_sell: canSell,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.business.id);

    if (updateErr) {
      console.error("[updateBusinessSettingsAction] update error:", updateErr.message);
      return { success: false, error: "Failed to update business settings. Please try again." };
    }

    // 6. Revalidate all relevant pages
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/members");
    revalidatePath("/dashboard/listings");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/profile");

    return {
      success: true,
      businessId: context.business.id,
      businessName: trimmedName,
    };
  } catch (err: unknown) {
    console.error("[updateBusinessSettingsAction] error:", err);
    return { success: false, error: safeErrorMessage(err) };
  }
}

