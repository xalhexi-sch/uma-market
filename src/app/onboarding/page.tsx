import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Tell us how you'll use UMA Market.",
};

export default async function OnboardingPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) redirect("/sign-in");

  // If the user already has a role (e.g. refreshed), send them to their dashboard
  const existingRole = sessionClaims?.user_role as string | undefined;
  if (existingRole === "farmer") redirect("/farmer");
  if (existingRole === "business") redirect("/business");
  if (existingRole === "admin") redirect("/admin");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Header */}
      <div className="mb-10 text-center">
        <p className="mb-2 text-sm font-medium tracking-wide text-primary uppercase">
          {APP_NAME}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          How will you use UMA?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Choose your role. You can only have one.
        </p>
      </div>

      <OnboardingForm />

      <p className="mt-6 text-xs text-muted-foreground">
        Your role cannot be changed after setup. Contact support if you need help.
      </p>
    </div>
  );
}
