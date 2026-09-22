"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Moderates a product's active status.
 * Server action restricted exclusively to admins.
 */
export async function moderateProductStatus(
  productId: string,
  newStatus: "active" | "draft" | "archived"
) {
  const { sessionClaims } = await auth();

  if (sessionClaims?.user_role !== "admin") {
    return { success: false, error: "Unauthorized. Admin role required." };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("products")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", productId);

  if (error) {
    console.error("[admin] moderateProductStatus error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/business/products");
  revalidatePath("/farmer/products");

  return { success: true };
}
