"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RiAlertLine, RiRefreshLine, RiArrowRightLine } from "@remixicon/react";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { Button, buttonVariants } from "@/components/ui/button";
import { routes } from "@/platform/routes";

export default function ProducerProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Producer profile error caught by boundary:", error);
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

      <main className="flex-1 flex items-center justify-center px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-5">
            <RiAlertLine className="size-7" aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Could not load producer profile
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            There was an unexpected problem loading this producer&apos;s information. Please try again or return to the marketplace.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              type="button"
              onClick={reset}
              variant="default"
              className="gap-2"
            >
              <RiRefreshLine className="size-4" aria-hidden="true" />
              <span>Try again</span>
            </Button>
            <Link
              href={routes.products}
              className={buttonVariants({ variant: "outline", className: "gap-2" })}
            >
              <span>Explore Marketplace</span>
              <RiArrowRightLine className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </main>

      <MarketplaceFooter />
    </div>
  );
}
