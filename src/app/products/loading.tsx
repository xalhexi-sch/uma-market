import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsMarketplaceLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Shared Minimal Public Header */}
      <div className="border-b border-border/60 bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Skeleton className="h-5 w-28" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </div>

      <main className="flex-1">
        {/* Marketplace Hero & Search Section */}
        <section className="border-b border-border/60 bg-muted/20 py-8 sm:py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <Skeleton className="h-9 w-72 max-w-full" />
              <Skeleton className="mt-3 h-5 w-full max-w-xl" />
            </div>

            <div className="mt-8 flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Skeleton className="h-10 w-full sm:max-w-md" />
                <Skeleton className="h-10 w-full sm:w-40" />
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-24 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Content Area */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-3 shadow-xs"
              >
                <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/2" />
                <Skeleton className="mt-3 h-5 w-1/3" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
