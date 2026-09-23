import Link from "next/link";
import { RiSearchLine, RiArrowLeftLine } from "@remixicon/react";
import { APP_NAME } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
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
          This dashboard page doesn&apos;t exist. It may have been removed or the link is incorrect.
        </p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/"
          className={buttonVariants({
            variant: "default",
            className: "min-w-[140px] gap-2",
          })}
        >
          <RiArrowLeftLine className="size-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
