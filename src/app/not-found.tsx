import Link from "next/link";
import { RiSearchLine } from "@remixicon/react";
import { APP_NAME } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-5">
        <RiSearchLine className="size-7" />
      </div>

      <div className="max-w-md space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {APP_NAME}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}
