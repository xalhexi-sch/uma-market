"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ProductsErrorState } from "@/components/products/products-error-state";

export default function ProductsMarketplaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Products marketplace error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3 sm:px-6">
          <Link href="/" className="text-sm font-semibold">
            UMA Market
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
        <ProductsErrorState onRetry={reset} />
      </main>
    </div>
  );
}
