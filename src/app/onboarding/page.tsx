import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { getProfileByClerkId } from "@/lib/supabase/queries/profiles";
import { routes } from "@/platform/routes";
import { consumeBusinessStaffInvitation } from "@/platform/member-actions";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Tell us how you'll use UMA Market.",
};

export default async function OnboardingPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) redirect("/sign-in");

  const clerk = await clerkClient();
  const currentUser = await clerk.users.getUser(userId);

  // Fallback: If user accepted a STAFF invitation, consume it and complete onboarding
  const metadata = currentUser.publicMetadata as Record<string, unknown> | undefined;
  const businessId = (metadata?.business_id as string | undefined)?.trim();
  const isStaffInvite = metadata?.role === "STAFF" || Boolean(metadata?.joined_as_staff);

  if (businessId && isStaffInvite) {
    const fullName = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ").trim() || null;
    const result = await consumeBusinessStaffInvitation({
      userId,
      metadata,
      fullName,
      avatarUrl: currentUser.imageUrl || null,
    });

    if (result.success && result.businessId) {
      redirect(`/onboarding/complete?role=business&business_id=${result.businessId}`);
    }
  }

  const existingRole =
    (currentUser.publicMetadata?.role as string | undefined) ||
    (sessionClaims?.user_role as string | undefined);
  if (existingRole === "admin") redirect("/admin");

  let recoveryRole: "farmer" | "business" | undefined;
  if (existingRole === "farmer" || existingRole === "business") {
    const profile = await getProfileByClerkId(userId);
    if (profile?.role === existingRole) redirect(routes.dashboardRoot);
    recoveryRole = existingRole;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Header */}
      <div className="mb-10 text-center">
        <p className="mb-2 text-sm font-medium tracking-wide text-primary uppercase">
          {APP_NAME}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {recoveryRole ? "Finish setting up your account" : "How will you use UMA?"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {recoveryRole
            ? `Your ${recoveryRole} role is already set. Complete profile setup to continue.`
            : "Choose your role. You can only have one."}
        </p>
      </div>

      <OnboardingForm existingRole={recoveryRole} />

      <p className="mt-6 text-xs text-muted-foreground">
        {recoveryRole
          ? "Your role is locked during profile recovery."
          : "Your role cannot be changed after setup. Contact support if you need help."}
      </p>
    </div>
  );
}
