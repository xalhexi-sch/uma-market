"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RiAlertLine, RiRefreshLine, RiArrowLeftLine } from "@remixicon/react";
import { Button, buttonVariants } from "@/components/ui/button";

interface ProductErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProductError({ error, reset }: ProductErrorProps) {
  useEffect(() => {
    console.error("Product page error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-5">
        <RiAlertLine className="size-7" />
      </div>

      <div className="max-w-md space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          UMA Market
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Unable to load this product
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We encountered an unexpected issue while loading this product listing.
          Please try again or browse other available produce.
        </p>

        {process.env.NODE_ENV === "development" && error.digest && (
          <p className="mt-2 text-xs font-mono text-muted-foreground/80 bg-muted px-2 py-1 rounded inline-block">
            Digest: {error.digest}
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
        <Button
          onClick={reset}
          className="w-full sm:w-auto min-w-[140px] gap-2"
        >
          <RiRefreshLine className="size-4" />
          Try Again
        </Button>
        <Link
          href="/products"
          className={buttonVariants({
            variant: "outline",
            className: "w-full sm:w-auto min-w-[140px] gap-2",
          })}
        >
          <RiArrowLeftLine className="size-4" />
          Back to Marketplace
        </Link>
      </div>
    </div>
  );
}
