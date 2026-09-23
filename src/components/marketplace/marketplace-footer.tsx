import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export function MarketplaceFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/20 mt-auto">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/icon/uma-icon-512.png"
              alt="UMA Market"
              width={24}
              height={24}
              className="h-6 w-6 rounded-md shadow-xs shrink-0"
            />
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
              Market
            </Link>
            <Link href="/#how" className="transition-colors hover:text-foreground">
              How it works
            </Link>
            <Link href="/#growers" className="transition-colors hover:text-foreground">
              For growers
            </Link>
            <Link href="/about" className="transition-colors hover:text-foreground">
              About
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
