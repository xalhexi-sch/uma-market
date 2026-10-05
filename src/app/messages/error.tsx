"use client";

import { useEffect } from "react";
import { RiAlertLine, RiRefreshLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";

export default function MessagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[messages] Error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center max-w-md mx-auto">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
        <RiAlertLine className="size-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Failed to load messages</h2>
      <p className="text-sm text-muted-foreground mt-1.5 mb-6 leading-relaxed">
        {error.message || "An unexpected error occurred while loading your conversations. Please try again."}
      </p>
      <Button onClick={reset} variant="default" size="sm" className="gap-2">
        <RiRefreshLine className="size-4" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}
