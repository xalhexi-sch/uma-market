import { clerkClient } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessRole } from "@/lib/types";

export interface BusinessMemberDetail {
  id: string;
  businessId: string;
  userId: string;
  role: BusinessRole;
  createdAt: string;
  fullName: string | null;
  businessName: string | null;
  email: string | null;
  status: string;
  isCurrentUser: boolean;
}

export interface BusinessInvitationDetail {
  id: string;
  email: string;
  role: BusinessRole;
  createdAt: string;
  status: string;
}

/**
 * Fetches all members for a given business ID.
 * Merges public.business_members, profiles, and Clerk primary emails.
 */
export async function getBusinessMembers(
  businessId: string,
  currentUserId: string
): Promise<BusinessMemberDetail[]> {
  if (!businessId) return [];

  const admin = createAdminClient();

  const { data: memberRows, error } = await admin
    .from("business_members")
    .select("id, business_id, user_id, role, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error || !memberRows || memberRows.length === 0) {
    return [];
  }

  const userIds = memberRows.map((m) => m.user_id);

  // Fetch Supabase profile details
  const { data: profiles } = await admin
    .from("profiles")
    .select("clerk_id, full_name, business_name, status")
    .in("clerk_id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.clerk_id, p]));

  // Fetch Clerk user details (emails) where available
  const emailMap = new Map<string, string>();
  try {
    const clerk = await clerkClient();
    const clerkUsers = await clerk.users.getUserList({ userId: userIds, limit: 100 });
    for (const u of clerkUsers.data) {
      const email = u.emailAddresses[0]?.emailAddress;
      if (email) {
        emailMap.set(u.id, email);
      }
    }
  } catch {
    // Non-blocking fallback for offline/isolated mock environments
  }

  return memberRows.map((m) => {
    const prof = profileMap.get(m.user_id);
    return {
      id: m.id,
      businessId: m.business_id,
      userId: m.user_id,
      role: m.role as BusinessRole,
      createdAt: m.created_at,
      fullName: prof?.full_name ?? null,
      businessName: prof?.business_name ?? null,
      email: emailMap.get(m.user_id) ?? null,
      status: prof?.status ?? "active",
      isCurrentUser: m.user_id === currentUserId,
    };
  });
}

/**
 * Fetches pending Clerk invitations associated with the given business ID.
 */
export async function getBusinessPendingInvitations(
  businessId: string
): Promise<BusinessInvitationDetail[]> {
  if (!businessId) return [];

  try {
    const clerk = await clerkClient();
    const invList = await clerk.invitations.getInvitationList({ status: "pending", limit: 50 });
    return invList.data
      .filter((inv) => {
        const meta = inv.publicMetadata as Record<string, unknown> | null;
        return meta?.business_id === businessId;
      })
      .map((inv) => {
        const meta = inv.publicMetadata as Record<string, unknown> | null;
        return {
          id: inv.id,
          email: inv.emailAddress,
          role: (meta?.role as BusinessRole) || "STAFF",
          createdAt: new Date(inv.createdAt).toISOString(),
          status: inv.status,
        };
      });
  } catch {
    return [];
  }
}
