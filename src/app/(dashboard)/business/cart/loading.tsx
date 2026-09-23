import { Skeleton } from "@/components/ui/skeleton";

export default function BusinessCartLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-4xl">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      {/* Cart groups */}
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="rounded-xl border border-border overflow-hidden">
          {/* Farmer header */}
          <div className="border-b border-border bg-muted/20 px-4 py-3">
            <Skeleton className="h-5 w-40" />
          </div>
          {/* Items */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border-b border-border last:border-0 px-4 py-3 flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
