import { Skeleton } from "@/components/ui/skeleton";

export default function ProducersLoading() {
  return (
    <main className="mx-auto min-h-[60vh] w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12" aria-busy="true" aria-label="Loading producers">
      <div className="mb-8 space-y-3 sm:mb-10">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <Skeleton className="mt-5 h-12 w-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
