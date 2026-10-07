"use client";

import { useState } from "react";
import { RiPlantLine, RiBuildingLine } from "@remixicon/react";
import { completeOnboarding } from "./actions";
import { Spinner } from "@/components/ui/spinner";

export function OnboardingForm({
  existingRole,
}: {
  existingRole?: "farmer" | "business";
}) {
  const [selectedRole, setSelectedRole] = useState<"farmer" | "business" | null>(existingRole ?? null);
  const [lockedRole, setLockedRole] = useState<"farmer" | "business" | undefined>(existingRole);
  const [businessName, setBusinessName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting || !selectedRole) return;

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("role", selectedRole);
    if (businessName.trim()) {
      formData.append("businessName", businessName.trim());
    }

    try {
      const result = await completeOnboarding(formData);
      if (result && !result.success) {
        if (result.recoveryRole) {
          setSelectedRole(result.recoveryRole);
          setLockedRole(result.recoveryRole);
        }
        setIsSubmitting(false);
        setError(result.error);
      }
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
        {/* Producer / Seller card */}
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
            disabled={Boolean(lockedRole && lockedRole !== "farmer")}
            onChange={() => setSelectedRole("farmer")}
            className="sr-only"
          />
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RiPlantLine className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground">Producer</p>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Sell produce
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              List agricultural produce, manage inventory and availability, and fulfill orders from local buyers.
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

        {/* Business / Buyer card */}
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
            disabled={Boolean(lockedRole && lockedRole !== "business")}
            onChange={() => setSelectedRole("business")}
            className="sr-only"
          />
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RiBuildingLine className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground">Business</p>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                Buy produce
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Source fresh local produce directly from verified producers for your restaurant, store, or food business.
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

      {/* Lightweight business name input */}
      <div className="mt-6 flex flex-col gap-1.5">
        <label htmlFor="business-name" className="text-sm font-medium text-foreground">
          {selectedRole === "farmer" ? "Farm or Producer Name" : "Business Name"}{" "}
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="business-name"
          name="businessName"
          type="text"
          placeholder={
            selectedRole === "farmer"
              ? "e.g., Green Valley Farm"
              : "e.g., Butuan Harvest Kitchen"
          }
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          maxLength={100}
          disabled={isSubmitting}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground">
          How your business will appear across UMA Market. You can update this later in profile settings.
        </p>
      </div>

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
          lockedRole ? "Retry profile setup" : "Continue"
        )}
      </button>
    </form>
  );
}
