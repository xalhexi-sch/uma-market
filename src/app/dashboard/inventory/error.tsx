"use client";

import { WorkspaceError } from "@/components/dashboard/workspace-error";

export default function InventoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <WorkspaceError title="We couldn't load your inventory" error={error} reset={reset} />;
}
