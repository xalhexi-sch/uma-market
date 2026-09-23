import Link from "next/link";
import { RiPlantLine } from "@remixicon/react";
import { APP_NAME } from "@/lib/constants";

export function MarketplaceFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/20 mt-auto">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <RiPlantLine className="size-3.5" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              {APP_NAME}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">
              Butuan City, Agusan del Norte
            </span>
          </div>

          <nav className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/products" className="transition-colors hover:text-foreground">
              Products
            </Link>
            <Link href="/#how" className="transition-colors hover:text-foreground">
              How it works
            </Link>
            <Link href="/#farmers" className="transition-colors hover:text-foreground">
              For Farmers
            </Link>
            <Link href="/#businesses" className="transition-colors hover:text-foreground">
              For Businesses
            </Link>
          </nav>
        </div>

        <div className="mt-6 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} {APP_NAME}. A localized agricultural marketplace connecting Butuan producers directly with commercial buyers.
          </p>
        </div>
      </div>
    </footer>
  );
}
