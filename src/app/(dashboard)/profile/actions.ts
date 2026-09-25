"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertActiveProfile } from "@/lib/supabase/queries/profiles";

export interface ProfileUpdateData {
  full_name?: string;
  business_name?: string;
  phone?: string;
  city?: string;
  bio?: string;
}

/**
 * Updates the authenticated user's profile.
 * Protected by Clerk auth() + Supabase RLS ('profiles: user updates own').
 */
export async function updateProfile(data: ProfileUpdateData) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  const { active, error: activeError } = await assertActiveProfile(userId);
  if (!active) {
    return { success: false, error: activeError ?? "Account is not active." };
  }

  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (data.full_name !== undefined) updates.full_name = data.full_name.trim() || null;
  if (data.business_name !== undefined) updates.business_name = data.business_name.trim() || null;
  if (data.phone !== undefined) updates.phone = data.phone.trim() || null;
  if (data.city !== undefined) updates.city = data.city.trim() || "Butuan City";
  if (data.bio !== undefined) updates.bio = data.bio.trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("clerk_id", userId);

  if (error) {
    console.error("[profile] updateProfile error:", error.message);
    return { success: false, error: "Could not update profile. Please try again." };
  }

  revalidatePath("/business/profile");
  revalidatePath("/farmer/profile");
  return { success: true };
}
