import { Skeleton } from "@/components/ui/skeleton";

export default function InventoryLoading() {
  return (
    <div className="min-h-screen bg-background pb-16" aria-busy="true" aria-label="Loading inventory">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between border-b border-border/60 px-4 sm:px-6">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="space-y-px overflow-hidden rounded-xl border border-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="size-11 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/5" />
              </div>
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-7 w-28 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
