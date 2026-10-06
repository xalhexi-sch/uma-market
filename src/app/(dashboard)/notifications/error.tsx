"use client";

import { RiErrorWarningLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function NotificationsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[50vh] items-center px-4 py-10 sm:px-6 lg:px-8">
      <Empty className="w-full rounded-xl border border-border bg-card">
        <EmptyMedia variant="icon"><RiErrorWarningLine className="size-5" aria-hidden="true" /></EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Could not load notifications</EmptyTitle>
          <EmptyDescription>Please try again in a moment.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={reset}>Try again</Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
