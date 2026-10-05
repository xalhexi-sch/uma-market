import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function BusinessOverviewLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} size="sm">
            <CardContent className="flex flex-col justify-between gap-2">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="size-7 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend + status */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-4 h-[200px] w-full rounded-md sm:h-[260px] lg:h-[280px]" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3.5 w-24" />
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Skeleton className="size-[150px] rounded-full" />
            <div className="w-full space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <div className="overflow-hidden rounded-xl border border-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="hidden h-4 w-32 sm:block" />
              <Skeleton className="ml-auto h-4 w-16" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3.5 w-36" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-card px-3 py-2.5">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}