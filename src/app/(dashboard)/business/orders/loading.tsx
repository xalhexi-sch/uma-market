import { Skeleton } from "@/components/ui/skeleton";

export default function BusinessOrdersLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex items-center gap-1 border-b border-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-3.5 py-2.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-7 rounded-full" />
          </div>
        ))}
      </div>

      {/* Order rows skeleton */}
      <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
        {/* Desktop header row */}
        <div className="hidden sm:grid sm:grid-cols-[minmax(180px,1.2fr)_minmax(180px,1.5fr)_minmax(110px,0.8fr)_minmax(100px,0.8fr)_auto] items-center gap-4 px-4 py-2.5 bg-muted/40">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-10 ml-auto" />
          <Skeleton className="h-3 w-12 ml-auto" />
        </div>

        {/* Rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-3">
            {/* Desktop row */}
            <div className="hidden sm:grid sm:grid-cols-[minmax(180px,1.2fr)_minmax(180px,1.5fr)_minmax(110px,0.8fr)_minmax(100px,0.8fr)_auto] items-center gap-4">
              <div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-5 w-18 rounded-full ml-auto" />
            </div>

            {/* Mobile row */}
            <div className="sm:hidden flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-1 h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-18 rounded-full shrink-0" />
              </div>
              <div className="flex items-center justify-between gap-3 pt-0.5">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
