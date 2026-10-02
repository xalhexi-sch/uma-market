import { Skeleton } from "@/components/ui/skeleton";

export default function PublicProductDetailLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="border-b border-border/60 bg-muted/20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-5 flex flex-col gap-6">
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="space-y-3">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-10 w-1/3" />
              </div>
              <Skeleton className="h-6 w-48" />
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
