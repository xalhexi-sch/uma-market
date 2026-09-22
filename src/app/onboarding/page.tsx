import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RiPlantLine, RiBuildingLine } from "@remixicon/react";
import { completeOnboarding } from "./actions";
import { APP_NAME } from "@/lib/constants";

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

      {/* Role cards */}
      <form action={completeOnboarding} className="w-full max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Farmer card */}
          <label
            htmlFor="role-farmer"
            className="group relative flex cursor-pointer flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary hover:shadow-md has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20"
          >
            <input
              id="role-farmer"
              type="radio"
              name="role"
              value="farmer"
              className="sr-only"
            />
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RiPlantLine className="size-6" />
            </div>
            <div>
              <p className="font-semibold text-foreground">I&apos;m a Farmer</p>
              <p className="mt-1 text-sm text-muted-foreground">
                List your produce, manage availability, and fulfill orders from local businesses.
              </p>
            </div>
            {/* Selected indicator */}
            <span className="absolute right-4 top-4 hidden size-5 items-center justify-center rounded-full bg-primary text-primary-foreground group-has-[:checked]:flex">
              <svg className="size-3" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </label>

          {/* Business card */}
          <label
            htmlFor="role-business"
            className="group relative flex cursor-pointer flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary hover:shadow-md has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20"
          >
            <input
              id="role-business"
              type="radio"
              name="role"
              value="business"
              className="sr-only"
            />
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RiBuildingLine className="size-6" />
            </div>
            <div>
              <p className="font-semibold text-foreground">I&apos;m a Business</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Source fresh local produce directly from Butuan&apos;s farms for your restaurant or store.
              </p>
            </div>
            <span className="absolute right-4 top-4 hidden size-5 items-center justify-center rounded-full bg-primary text-primary-foreground group-has-[:checked]:flex">
              <svg className="size-3" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Continue
        </button>
      </form>

      <p className="mt-6 text-xs text-muted-foreground">
        Your role cannot be changed after setup. Contact support if you need help.
      </p>
    </div>
  );
}
