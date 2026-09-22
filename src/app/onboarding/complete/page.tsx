"use client";

import { useEffect } from "react";
import { useSession } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { APP_NAME } from "@/lib/constants";

/**
 * Onboarding completion page.
 *
 * After the Server Action sets `publicMetadata.role` in Clerk, the existing
 * session JWT won't carry the new `role` claim until it naturally expires
 * (~60 seconds). This page forces an immediate session token reload so that
 * all subsequent server renders see the updated claims without the delay.
 *
 * Flow: /onboarding → completeOnboarding() → /onboarding/complete → session.reload() → /farmer or /business
 */
export default function OnboardingCompletePage() {
  const { session, isLoaded } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role");

  useEffect(() => {
    if (!isLoaded || !session) return;

    // Force a session token refresh so the new role claim is available.
    session.reload().then(() => {
      if (role === "farmer") router.replace("/farmer");
      else if (role === "business") router.replace("/business");
      else router.replace("/");
    });
  }, [isLoaded, session, role, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Spinner className="size-8 text-primary" />
      <p className="text-sm font-medium text-muted-foreground">
        Setting up your {APP_NAME} account…
      </p>
    </div>
  );
}
