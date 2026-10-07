"use server";

/**
 * UMA Platform — V4 Business Member & Staff Actions
 *
 * Implements server actions for:
 * 1. Inviting or adding STAFF members (restricted to active business OWNER)
 * 2. Removing STAFF members (restricted to active business OWNER)
 * 3. Revoking pending invitations (restricted to active business OWNER)
 *
 * Strictly scoped to the caller's active business context.
 * An OWNER cannot remove themselves or violate domain constraints.
 * STAFF callers are strictly forbidden from performing management actions.
 */

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { requireBusinessRole } from "@/platform/business-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeErrorMessage } from "@/platform/errors";
import { routes } from "@/platform/routes";

export interface MemberActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invites or adds a STAFF member to the caller's active business.
 * If the user already has an account, they are added immediately to business_members.
 * If the user does not exist yet, a Clerk invitation is sent with business metadata.
 */
export async function inviteBusinessStaffAction(input: {
  email: string;
}): Promise<MemberActionResult> {
  try {
    // 1. Strict authorization: Caller must be an OWNER of their currently active business
    const context = await requireBusinessRole("OWNER");
    const businessId = context.business.id;

    // 2. Validate email input
    const normalizedEmail = (input?.email || "").trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return { success: false, error: "Please provide a valid email address." };
    }

    const admin = createAdminClient();
    const clerk = await clerkClient();

    // 3. Lookup user in Clerk by email
    let existingClerkUser: { id: string; emailAddresses: Array<{ emailAddress: string }> } | null = null;
    try {
      const userList = await clerk.users.getUserList({
        emailAddress: [normalizedEmail],
        limit: 1,
      });
      existingClerkUser = userList.data[0] ?? null;
    } catch (err: unknown) {
      console.warn("[member-actions] Clerk user lookup failed:", safeErrorMessage(err));
    }

    // Fallback: check Supabase profiles if Clerk lookup is unavailable
    if (!existingClerkUser) {
      const { data: profile } = await admin
        .from("profiles")
        .select("clerk_id")
        .eq("clerk_id", normalizedEmail)
        .maybeSingle();

      if (profile?.clerk_id) {
        existingClerkUser = {
          id: profile.clerk_id,
          emailAddresses: [{ emailAddress: normalizedEmail }],
        };
      }
    }

    // 4. Branch A: User already exists
    if (existingClerkUser) {
      const targetUserId = existingClerkUser.id;

      // Prevent owner from inviting themselves
      if (targetUserId === context.user.userId) {
        return { success: false, error: "You are already the owner of this business." };
      }

      // Check if already a member of this business
      const { data: existingMember } = await admin
        .from("business_members")
        .select("id, role")
        .eq("business_id", businessId)
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (existingMember) {
        if (existingMember.role === "OWNER") {
          return { success: false, error: "This user is already the owner of this business." };
        }
        return { success: false, error: "This user is already a staff member of this business." };
      }

      // Insert STAFF membership
      const { error: insertErr } = await admin.from("business_members").insert({
        business_id: businessId,
        user_id: targetUserId,
        role: "STAFF",
      });

      if (insertErr) {
        return { success: false, error: safeErrorMessage(insertErr) };
      }

      revalidatePath(routes.dashboard.members);
      revalidatePath(routes.dashboardRoot);
      return {
        success: true,
        message: `Added staff member to ${context.business.name}.`,
      };
    }

    // 5. Branch B: User does not exist yet → Send Clerk invitation
    try {
      const pendingInvs = await clerk.invitations.getInvitationList({ status: "pending", limit: 50 });
      const alreadyInvited = pendingInvs.data.some(
        (inv) =>
          inv.emailAddress === normalizedEmail &&
          (inv.publicMetadata as Record<string, unknown> | null)?.business_id === businessId
      );

      if (alreadyInvited) {
        return {
          success: false,
          error: "An invitation has already been sent to this email address.",
        };
      }

      await clerk.invitations.createInvitation({
        emailAddress: normalizedEmail,
        publicMetadata: {
          business_id: businessId,
          role: "STAFF",
        },
        ignoreExisting: true,
      });

      revalidatePath(routes.dashboard.members);
      revalidatePath(routes.dashboardRoot);
      return {
        success: true,
        message: `Invitation sent to ${normalizedEmail}.`,
      };
    } catch (inviteErr: unknown) {
      return { success: false, error: safeErrorMessage(inviteErr) };
    }
  } catch (err: unknown) {
    return { success: false, error: safeErrorMessage(err) };
  }
}

/**
 * Removes a STAFF member from the caller's active business.
 * OWNERs cannot be removed, and users cannot remove themselves.
 */
export async function removeBusinessMemberAction(input: {
  memberId: string;
}): Promise<MemberActionResult> {
  try {
    // 1. Strict authorization: Caller must be an OWNER of their currently active business
    const context = await requireBusinessRole("OWNER");
    const businessId = context.business.id;

    if (!input?.memberId) {
      return { success: false, error: "Member ID is required." };
    }

    const admin = createAdminClient();

    // 2. Fetch the target membership row scoped to this business
    const { data: targetMember, error: fetchErr } = await admin
      .from("business_members")
      .select("id, business_id, user_id, role")
      .eq("id", input.memberId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (fetchErr || !targetMember) {
      return { success: false, error: "Member not found in this business." };
    }

    // 3. OWNER protections
    if (targetMember.role === "OWNER") {
      return { success: false, error: "Business owners cannot be removed." };
    }

    if (targetMember.user_id === context.user.userId) {
      return { success: false, error: "You cannot remove yourself from the business." };
    }

    // 4. Delete the membership
    const { error: delErr } = await admin
      .from("business_members")
      .delete()
      .eq("id", input.memberId)
      .eq("business_id", businessId);

    if (delErr) {
      return { success: false, error: safeErrorMessage(delErr) };
    }

    revalidatePath(routes.dashboard.members);
    revalidatePath(routes.dashboardRoot);
    return {
      success: true,
      message: "Staff member removed successfully.",
    };
  } catch (err: unknown) {
    return { success: false, error: safeErrorMessage(err) };
  }
}

/**
 * Revokes a pending Clerk invitation for the caller's active business.
 */
export async function revokeBusinessInvitationAction(input: {
  invitationId: string;
}): Promise<MemberActionResult> {
  try {
    const context = await requireBusinessRole("OWNER");
    const businessId = context.business.id;

    if (!input?.invitationId) {
      return { success: false, error: "Invitation ID is required." };
    }

    const clerk = await clerkClient();

    // Verify invitation belongs to this business
    const invList = await clerk.invitations.getInvitationList({ status: "pending", limit: 50 });
    const targetInv = invList.data.find((i) => i.id === input.invitationId);

    if (
      !targetInv ||
      (targetInv.publicMetadata as Record<string, unknown> | null)?.business_id !== businessId
    ) {
      return { success: false, error: "Invitation not found for this business." };
    }

    await clerk.invitations.revokeInvitation(input.invitationId);

    revalidatePath(routes.dashboard.members);
    revalidatePath(routes.dashboardRoot);
    return {
      success: true,
      message: "Invitation revoked.",
    };
  } catch (err: unknown) {
    return { success: false, error: safeErrorMessage(err) };
  }
}
