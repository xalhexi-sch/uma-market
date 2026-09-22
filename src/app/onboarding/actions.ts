"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, type UserRole } from "@/lib/constants";

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
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = formData.get("role") as string;
  if (!Object.values(ROLES).includes(role as UserRole)) {
    throw new Error("Invalid role selection.");
  }

  // 1. Set role in Clerk publicMetadata
  const clerk = await clerkClient();
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
