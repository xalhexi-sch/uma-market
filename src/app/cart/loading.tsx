import { Skeleton } from "@/components/ui/skeleton";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";

export default function CartLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {/* Business banner skeleton */}
        <Skeleton className="mb-6 h-16 w-full rounded-xl" />

        {/* Title skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-44 rounded-md" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>

        {/* Items layout */}
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          <div className="space-y-6 lg:col-span-8">
            <div className="rounded-xl border border-border p-4 space-y-4">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
            <div className="rounded-xl border border-border p-4 space-y-4">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </div>
          <div className="lg:col-span-4">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
