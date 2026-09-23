"use client";

import { useState } from "react";
import { RiPlantLine, RiBuildingLine } from "@remixicon/react";
import { completeOnboarding } from "./actions";
import { Spinner } from "@/components/ui/spinner";

export function OnboardingForm() {
  const [selectedRole, setSelectedRole] = useState<"farmer" | "business" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting || !selectedRole) return;

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("role", selectedRole);

    try {
      await completeOnboarding(formData);
    } catch (err: unknown) {
      // In Next.js, redirect() throws an error containing NEXT_REDIRECT.
      // We must not treat it as an error or reset isSubmitting, since navigation is in progress.
      const errorMsg = (err as Error)?.message || "";
      if (errorMsg.includes("NEXT_REDIRECT")) {
        return;
      }
      console.error("[onboarding] Submission error:", err);
      setIsSubmitting(false);
      setError("Failed to complete onboarding. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <fieldset disabled={isSubmitting} className="grid gap-4 sm:grid-cols-2">
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
            checked={selectedRole === "farmer"}
            onChange={() => setSelectedRole("farmer")}
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
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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
            checked={selectedRole === "business"}
            onChange={() => setSelectedRole("business")}
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
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </label>
      </fieldset>

      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!selectedRole || isSubmitting}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Spinner className="size-4 animate-spin text-primary-foreground" />
            <span>Setting up your account…</span>
          </>
        ) : (
          "Continue"
        )}
      </button>
    </form>
  );
}
