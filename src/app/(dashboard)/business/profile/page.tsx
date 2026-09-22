import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getProfileByClerkId } from "@/lib/supabase/queries/profiles";
import { ProfileForm } from "@/components/dashboard/profile-form";

export const metadata = {
  title: "Business Profile — UMA Market",
  description: "Manage your business details, contacts, and delivery location.",
};

export default async function BusinessProfilePage() {
  const { userId, sessionClaims } = await auth();

  if (!userId || sessionClaims?.user_role !== "business") {
    redirect("/sign-in");
  }

  const profile = await getProfileByClerkId(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Business Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Keep your business contact and location details up to date for farm suppliers.
        </p>
      </div>

      <ProfileForm profile={profile} role="business" />
    </div>
  );
}
