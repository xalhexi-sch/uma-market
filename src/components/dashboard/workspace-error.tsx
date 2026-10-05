"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RiAlertLine, RiRefreshLine } from "@remixicon/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { routes } from "@/platform/routes";

interface WorkspaceErrorProps {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}

/** Error state for /dashboard/* sections. Never shows the raw error to the user. */
export function WorkspaceError({ title, error, reset }: WorkspaceErrorProps) {
  useEffect(() => {
    console.error("[WorkspaceError]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background p-6 text-foreground">
      <div role="alert" className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <RiAlertLine className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong while loading this page. Your data is safe — please try again.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={() => reset()}>
            <RiRefreshLine className="mr-1.5 size-4" aria-hidden="true" />
            Try again
          </Button>
          <Link href={routes.dashboardRoot} className={buttonVariants({ variant: "outline" })}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
