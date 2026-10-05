import { Skeleton } from "@/components/ui/skeleton";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";

export default function OrdersLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-6">
          {/* Heading skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 rounded-md" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>

          {/* Context bar skeleton */}
          <Skeleton className="h-16 w-full rounded-xl" />

          {/* Tabs skeleton */}
          <div className="flex gap-4 border-b border-border pb-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>

          {/* Orders list skeleton */}
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-4 w-60 rounded-md" />
            </div>
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-44 rounded-md" />
              <Skeleton className="h-4 w-52 rounded-md" />
            </div>
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-36 rounded-md" />
              <Skeleton className="h-4 w-64 rounded-md" />
            </div>
          </div>
        </div>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
