"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RiAlertLine, RiRefreshLine, RiHome4Line } from "@remixicon/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    console.error("Root error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-5">
        <RiAlertLine className="size-7" />
      </div>

      <div className="max-w-md space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {APP_NAME}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          An unexpected error occurred while loading this page. Please try refreshing or return to the marketplace.
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
          href="/"
          className={buttonVariants({
            variant: "outline",
            className: "w-full sm:w-auto min-w-[140px] gap-2",
          })}
        >
          <RiHome4Line className="size-4" />
          Return Home
        </Link>
      </div>
    </div>
  );
}
