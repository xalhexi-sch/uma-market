import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getProfileByClerkId } from "@/lib/supabase/queries/profiles";
import { ProfileForm } from "@/components/dashboard/profile-form";

export const metadata = {
  title: "Farmer Profile — UMA Market",
  description: "Manage your farm identity, location, and produce specialties.",
};

export default async function FarmerProfilePage() {
  const { userId, sessionClaims } = await auth();

  if (!userId || sessionClaims?.user_role !== "farmer") {
    redirect("/sign-in");
  }

  const profile = await getProfileByClerkId(userId);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Producer Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Provide accurate details about your farm location and harvest methods for commercial buyers.
        </p>
      </div>

      <ProfileForm profile={profile} role="farmer" />
    </div>
  );
}
