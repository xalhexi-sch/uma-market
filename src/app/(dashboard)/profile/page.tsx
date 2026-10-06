import { auth } from "@clerk/nextjs/server";
import { getProfileByClerkId } from "@/lib/supabase/queries/profiles";
import { ProfileForm } from "@/components/dashboard/profile-form";
import type { UserRole } from "@/lib/constants";

export const metadata = {
  title: "Profile — UMA Market",
  description: "Manage your contact details, location, and profile information.",
};

/**
 * Canonical profile route for every authenticated persona (buyer, producer,
 * admin). Legacy /business/profile and /farmer/profile redirect here via
 * next.config.ts. Authentication, role existence, and the
 * inactive/suspended/revoked gate are enforced by the (dashboard) layout
 * before this page renders.
 */
export default async function ProfilePage() {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.user_role as UserRole;
  // Deduped with the layout's own profile fetch via React cache().
  const profile = userId ? await getProfileByClerkId(userId) : null;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Keep your contact and location details up to date for your trading partners.
        </p>
      </div>

      <ProfileForm profile={profile} role={role} />
    </div>
  );
}
