import { Skeleton } from "@/components/ui/skeleton";

export default function FarmerDashboardLoading() {
  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>

      {/* My products */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border-b border-border last:border-0 px-4 py-3 flex items-center gap-4"
            >
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent orders */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border-b border-border last:border-0 px-4 py-3 flex items-center gap-4"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
