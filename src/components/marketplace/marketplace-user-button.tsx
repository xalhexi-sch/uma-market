"use client";

import { useSyncExternalStore } from "react";
import { UserButton } from "@clerk/nextjs";

const emptySubscribe = () => () => {};

export function MarketplaceUserButton() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div
        className="size-8 rounded-full bg-muted/60 border border-border/50 animate-pulse"
        aria-hidden="true"
      />
    );
  }

  return <UserButton />;
}
