import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Fetch a profile by Clerk user ID using the authenticated Supabase server client.
 * Wrapped in React cache() to deduplicate per-request calls (e.g. DashboardLayout + Page).
 */
export const getProfileByClerkId = cache(
  async (clerkId: string): Promise<Profile | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("clerk_id", clerkId)
      .maybeSingle();

    if (error) {
      console.error("[profiles] getProfileByClerkId error:", error.message);
      return null;
    }

    return data as Profile | null;
  }
);

/**
 * Check whether a user profile is active.
 * Used by Server Actions and route handlers to block mutations from suspended/revoked accounts.
 */
export async function assertActiveProfile(clerkId: string): Promise<{ active: boolean; error?: string; profile?: Profile }> {
  const profile = await getProfileByClerkId(clerkId);
  if (profile && profile.status && profile.status !== "active") {
    return {
      active: false,
      error: `Account is ${profile.status}. Access denied.`,
      profile,
    };
  }
  return { active: true, profile: profile ?? undefined };
}
