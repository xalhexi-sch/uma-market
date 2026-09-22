import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Fetch a profile by Clerk user ID using the authenticated Supabase server client.
 */
export async function getProfileByClerkId(clerkId: string): Promise<Profile | null> {
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
