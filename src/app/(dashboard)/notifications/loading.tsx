import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <main className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8" aria-busy="true" aria-label="Loading notifications">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72 max-w-[75vw]" />
        </div>
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="mt-1.5 size-2 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
