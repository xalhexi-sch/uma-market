import Link from "next/link";
import { RiPlantLine, RiShoppingBagLine, RiStore2Line } from "@remixicon/react";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/platform/routes";

interface SellingCapabilityRequiredProps {
  businessName: string;
  /** What the page manages, e.g. "listings" or "inventory". */
  area: string;
}

/**
 * Shown instead of producer tools when the active business can't sell.
 * The page renders this without loading any producer data.
 */
export function SellingCapabilityRequired({ businessName, area }: SellingCapabilityRequiredProps) {
  return (
    <div
      data-testid="selling-capability-required"
      className="rounded-2xl border border-border bg-card p-8 text-center shadow-2xs"
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <RiPlantLine className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">Selling isn&apos;t turned on for this business</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{businessName}</span> buys on UMA, so there are no {area} to
        manage. Switch to a business that sells to manage its {area}.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href={routes.orders} className={buttonVariants({ size: "sm" })}>
          <RiShoppingBagLine className="mr-1.5 size-4" aria-hidden="true" />
          View my orders
        </Link>
        <Link href={routes.products} className={buttonVariants({ size: "sm", variant: "outline" })}>
          <RiStore2Line className="mr-1.5 size-4" aria-hidden="true" />
          Browse marketplace
        </Link>
      </div>
    </div>
  );
}
