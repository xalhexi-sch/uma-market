import { Skeleton } from "@/components/ui/skeleton";

export default function SellerOrdersLoading() {
  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header skeleton */}
      <div className="h-16 border-b border-border/60 bg-background/95 px-4 sm:px-6 flex items-center justify-between max-w-6xl mx-auto">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Context bar skeleton */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Skeleton className="size-11 rounded-xl" />
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-6 w-48" />
              </div>
            </div>
            <Skeleton className="h-8 w-36" />
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-2 border-b border-border pb-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>

        {/* Orders cards skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
