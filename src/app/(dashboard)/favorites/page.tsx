import type { Metadata } from "next";
import Link from "next/link";
import { RiHeart3Line, RiPlantLine } from "@remixicon/react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/platform/routes";

export const metadata: Metadata = {
  title: "Favorites | UMA Market",
  description: "Keep your favorite UMA products and producers close at hand.",
};

export default function FavoritesPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Favorites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep products and local producers you want to find again in one place.
        </p>
      </header>

      <Empty className="min-h-72 rounded-xl border border-dashed border-border bg-card/50 px-5 py-12">
        <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
          <RiHeart3Line className="size-5" aria-hidden="true" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No favorites yet</EmptyTitle>
          <EmptyDescription className="max-w-md">
            Your saved products and producers will appear here. Browse UMA to discover supplies and local partners.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <Link href={routes.products} className={buttonVariants({ size: "sm" })}>
            Explore products
          </Link>
          <Link href={routes.producers} className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}>
            <RiPlantLine className="size-4" aria-hidden="true" />
            Find producers
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  );
}
