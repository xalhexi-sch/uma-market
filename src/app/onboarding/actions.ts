"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES } from "@/lib/constants";
import { onboardingRateLimit } from "@/lib/rate-limit";
import { routes } from "@/platform/routes";

const ONBOARDING_RATE_LIMIT_ERROR = "Too many attempts. Please wait a few minutes and try again.";

/**
 * Called when the user submits the onboarding role-selection form.
 *
 * Sequence:
 * 1. Verify authentication.
 * 2. Validate the submitted role.
 * 3. Set `publicMetadata.role` via Clerk Backend API.
 * 4. Create the profile row in Supabase using the service-role client
 *    (necessary because the session JWT doesn't carry the new role yet —
 *    the token needs to refresh before RLS policies based on role would pass).
 * 5. Redirect to /onboarding/complete which forces a session token reload
 *    before forwarding to the appropriate dashboard.
 */
export async function completeOnboarding(formData: FormData) {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const clerk = await clerkClient();
  const currentUser = await clerk.users.getUser(userId);
  const existingClaimRole = sessionClaims?.user_role as string | undefined;
  const existingClerkRole = currentUser.publicMetadata?.role as string | undefined;

  const ALLOWED_ONBOARDING_ROLES: string[] = [ROLES.FARMER, ROLES.BUSINESS];
  if (existingClaimRole && existingClerkRole && existingClaimRole !== existingClerkRole) {
    return {
      success: false as const,
      error: "Your account role could not be verified. Refresh your session and try again.",
    };
  }

  const existingRole = existingClerkRole || existingClaimRole;
  let role: string;
  let clerkUser = currentUser;
  const supabase = createAdminClient();

  if (existingRole) {
    if (existingRole === ROLES.ADMIN) redirect("/admin");
    if (!ALLOWED_ONBOARDING_ROLES.includes(existingRole)) {
      return {
        success: false as const,
        error: "This account already has a role that cannot use public onboarding.",
      };
    }

    // Rate limit: 5 attempts per 5 minutes (role-recovery path).
    const rateResult = onboardingRateLimit(userId);
    if (!rateResult.success) {
      return { success: false as const, error: ONBOARDING_RATE_LIMIT_ERROR };
    }

    // Recovery uses only the existing Clerk role; submitted form data cannot change it.
    role = existingRole;
    const { data: profile, error: lookupError } = await supabase
      .from("profiles")
      .select("clerk_id, role")
      .eq("clerk_id", userId)
      .maybeSingle();

    if (lookupError) {
      console.error("[onboarding] Failed to check profile:", lookupError.message);
      return {
        success: false as const,
        error: "We couldn't check your profile. Please try again.",
      };
    }

    if (profile) {
      if (profile.role !== role) {
        return {
          success: false as const,
          error: "Your account role and profile do not match. Please contact support.",
        };
      }
      // Guarantee business is provisioned even if profile already existed
      const { error: provError } = await supabase.rpc("provision_owner_business", {
        p_clerk_id: userId,
      });
      if (provError) {
        console.error("[onboarding] Failed to provision business during recovery:", provError.message);
      }
      redirect(routes.dashboardRoot);
    }
  } else {
    // Rate limit: 5 attempts per 5 minutes (first-time onboarding path).
    const rateResult = onboardingRateLimit(userId);
    if (!rateResult.success) {
      return { success: false as const, error: ONBOARDING_RATE_LIMIT_ERROR };
    }

    const { data: existingProfile, error: lookupError } = await supabase
      .from("profiles")
      .select("clerk_id")
      .eq("clerk_id", userId)
      .maybeSingle();

    if (lookupError) {
      console.error("[onboarding] Failed to check profile:", lookupError.message);
      return {
        success: false as const,
        error: "We couldn't check your profile. Please try again.",
      };
    }
    if (existingProfile) {
      return {
        success: false as const,
        error: "A profile already exists for your account. Refresh your session or contact support.",
      };
    }

    const submittedRole = formData.get("role");
    if (typeof submittedRole !== "string" || !ALLOWED_ONBOARDING_ROLES.includes(submittedRole)) {
      return {
        success: false as const,
        error: "Choose a valid farmer or business role to continue.",
      };
    }

    role = submittedRole;
    // A new account can choose a role once. Recovery never changes Clerk metadata.
    clerkUser = await clerk.users.updateUser(userId, {
      publicMetadata: { role },
    });
  }

  const submittedBusinessName = formData.get("businessName");
  const businessName =
    typeof submittedBusinessName === "string" && submittedBusinessName.trim()
      ? submittedBusinessName.trim().slice(0, 100)
      : null;

  // Profile identity always comes from authenticated Clerk auth(), never form data.
  // The service-role client is needed before a new role is present in the session JWT.
  const { error } = await supabase.from("profiles").upsert(
    {
      clerk_id: userId,
      role,
      business_name: businessName,
      full_name:
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        null,
      city: "Butuan",
      is_verified: false,
      avatar_url: clerkUser.hasImage ? clerkUser.imageUrl : null,
    },
    { onConflict: "clerk_id" }
  );

  if (error) {
    console.error("[onboarding] Failed to create profile:", error.message);
    return {
      success: false as const,
      error: `Your ${role} role is saved, but profile setup failed. Please retry to finish setup.`,
      recoveryRole: role as "farmer" | "business",
    };
  }

  // Explicitly invoke business provisioning to ensure business + OWNER membership exist
  const { error: provError } = await supabase.rpc("provision_owner_business", {
    p_clerk_id: userId,
  });
  if (provError) {
    console.error("[onboarding] Failed to provision business:", provError.message);
  }

  // 3. Redirect to /onboarding/complete which reloads the session token
  //    before forwarding to the correct dashboard.
  redirect(`/onboarding/complete?role=${role}`);
}
