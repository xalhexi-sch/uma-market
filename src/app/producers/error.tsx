"use client";

import Link from "next/link";
import { RiErrorWarningLine } from "@remixicon/react";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { routes } from "@/platform/routes";

export default function ProducersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-6xl items-center px-4 py-12 sm:px-6">
      <Empty className="w-full rounded-xl border border-border bg-card">
        <EmptyMedia variant="icon"><RiErrorWarningLine className="size-5" aria-hidden="true" /></EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Could not load producers</EmptyTitle>
          <EmptyDescription>Please try again, or browse the available products.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <button type="button" onClick={reset} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Try again
          </button>
          <Link href={routes.products} className={buttonVariants({ size: "sm" })}>Browse products</Link>
        </EmptyContent>
      </Empty>
    </main>
  );
}
