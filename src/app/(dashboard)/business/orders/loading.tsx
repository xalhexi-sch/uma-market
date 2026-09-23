import { Skeleton } from "@/components/ui/skeleton";

export default function BusinessOrdersLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-5xl">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-2 h-4 w-24" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Table header */}
        <div className="border-b border-border bg-muted/30 px-4 py-3 flex gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16 hidden sm:block" />
          <Skeleton className="h-4 w-20 hidden md:block" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-4 w-16" />
        </div>
        {/* Rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-border last:border-0 px-4 py-3 flex items-center gap-4"
          >
            <div className="min-w-[70px]">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-1 h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-12 hidden sm:block" />
            <Skeleton className="h-4 w-20 hidden md:block" />
            <Skeleton className="h-4 w-14 ml-auto" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
