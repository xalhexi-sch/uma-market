import { Skeleton } from "@/components/ui/skeleton";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";

export default function OrderDetailLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-6">
          {/* Back link skeleton */}
          <Skeleton className="h-5 w-32 rounded-md" />

          {/* Heading skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-8 w-48 rounded-md" />
            <Skeleton className="h-4 w-64 rounded-md" />
          </div>

          {/* Banner skeleton */}
          <Skeleton className="h-20 w-full rounded-xl" />

          {/* Stepper skeleton */}
          <Skeleton className="h-24 w-full rounded-xl" />

          {/* Grid layout */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)]">
            <div className="space-y-6">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-44 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
