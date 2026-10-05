import Link from "next/link";
import { RiStore2Line, RiArrowRightLine } from "@remixicon/react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/platform/routes";

export default function ProducerNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketplaceHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-5">
            <RiStore2Line className="size-7 text-primary" aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Producer Not Found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            The producer profile you are looking for does not exist, has been removed, or is not currently active on UMA Market.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={routes.products}
              className={buttonVariants({ variant: "default", className: "gap-2" })}
            >
              <span>Explore Marketplace</span>
              <RiArrowRightLine className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href={routes.home}
              className={buttonVariants({ variant: "outline" })}
            >
              Go to Homepage
            </Link>
          </div>
        </div>
      </main>

      <MarketplaceFooter />
    </div>
  );
}
