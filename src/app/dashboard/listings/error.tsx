"use client";

import { WorkspaceError } from "@/components/dashboard/workspace-error";

export default function ListingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <WorkspaceError title="We couldn't load your listings" error={error} reset={reset} />;
}
