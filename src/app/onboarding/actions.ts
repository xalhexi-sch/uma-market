"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES } from "@/lib/constants";

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

  // Prevent role re-assignment if user already has an assigned role
  const existingClaimRole = sessionClaims?.user_role as string | undefined;
  if (existingClaimRole) {
    if (existingClaimRole === "farmer") redirect("/farmer");
    if (existingClaimRole === "business") redirect("/business");
    if (existingClaimRole === "admin") redirect("/admin");
    throw new Error("User already has an assigned role.");
  }

  // Also check authoritative Clerk user record in case session claims haven't updated yet
  const clerk = await clerkClient();
  const currentUser = await clerk.users.getUser(userId);
  const existingClerkRole = currentUser.publicMetadata?.role as string | undefined;
  if (existingClerkRole) {
    if (existingClerkRole === "farmer") redirect("/farmer");
    if (existingClerkRole === "business") redirect("/business");
    if (existingClerkRole === "admin") redirect("/admin");
    throw new Error("User already has an assigned role.");
  }

  const role = formData.get("role") as string;
  // Strict allowlist: only farmer and business are permitted via public onboarding.
  // The 'admin' role must NEVER be assignable through public onboarding.
  const ALLOWED_ONBOARDING_ROLES: string[] = [ROLES.FARMER, ROLES.BUSINESS];
  if (!ALLOWED_ONBOARDING_ROLES.includes(role)) {
    throw new Error(
      "Invalid role selection. Only farmer and business accounts can be created through onboarding."
    );
  }

  // 1. Set role in Clerk publicMetadata
  const clerkUser = await clerk.users.updateUser(userId, {
    publicMetadata: { role },
  });

  // 2. Upsert profile row in Supabase
  //    Use the service-role client because the session token hasn't refreshed yet.
  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      clerk_id: userId,
      role,
      full_name:
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        null,
      city: "Butuan",
      is_verified: false,
    },
    { onConflict: "clerk_id" }
  );

  if (error) {
    // Profile creation failed — still redirect so the user can retry
    // from their dashboard (profile is non-blocking for auth).
    console.error("[onboarding] Failed to create profile:", error.message);
  }

  // 3. Redirect to /onboarding/complete which reloads the session token
  //    before forwarding to the correct dashboard.
  redirect(`/onboarding/complete?role=${role}`);
}
