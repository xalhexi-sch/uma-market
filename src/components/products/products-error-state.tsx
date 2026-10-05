import { RiAlertLine, RiRefreshLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";

interface ProductsErrorStateProps {
  title?: string;
  description?: string;
  /** Client-side retry handler. */
  onRetry?: () => void;
  /** Server-rendered retry: plain link that re-requests the page. */
  retryHref?: string;
}

/** Shared error panel for /products (server-rendered and client-side search failures). */
export function ProductsErrorState({
  title = "We couldn't load produce right now",
  description = "Something went wrong on our side. Your search is unchanged — please try again.",
  onRetry,
  retryHref,
}: ProductsErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-card py-16 px-4 text-center"
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <RiAlertLine className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button type="button" onClick={onRetry} className="mt-6 gap-1.5">
          <RiRefreshLine className="size-4" aria-hidden="true" />
          Try again
        </Button>
      ) : retryHref ? (
        <a
          href={retryHref}
          className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <RiRefreshLine className="size-4" aria-hidden="true" />
          Try again
        </a>
      ) : null}
    </div>
  );
}
