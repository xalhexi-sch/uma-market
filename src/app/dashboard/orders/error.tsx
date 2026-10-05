"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RiAlertLine, RiRefreshLine } from "@remixicon/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { routes } from "@/platform/routes";

export default function SellerOrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SellerOrdersError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3 sm:px-6">
          <Link href={routes.home} className="text-sm font-semibold">
            UMA Market
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <RiAlertLine className="size-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Unable to load seller orders
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error occurred while loading your incoming wholesale sales orders. Please try again.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={() => reset()} variant="default">
              <RiRefreshLine className="mr-2 size-4" aria-hidden="true" />
              Try again
            </Button>
            <Link
              href={routes.dashboardRoot}
              className={buttonVariants({ variant: "outline" })}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
