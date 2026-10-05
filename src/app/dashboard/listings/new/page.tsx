import Link from "next/link";
import type { Metadata } from "next";
import { RiArrowLeftLine } from "@remixicon/react";
import { WorkspacePageShell } from "@/components/dashboard/workspace-page-shell";
import { SellingCapabilityRequired } from "@/components/dashboard/selling-capability-required";
import { ProductForm } from "@/components/dashboard/product-form";
import { getCategories } from "@/lib/supabase/queries/products";
import { routes } from "@/platform/routes";
import { requireWorkspaceBusiness } from "../../_lib/require-workspace-business";
import { LISTING_FORM_ACTIONS } from "../listing-form-actions";

export const metadata: Metadata = {
  title: "New listing — UMA Market",
  description: "List a product for your business on UMA Market.",
};

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const { business, canSell } = await requireWorkspaceBusiness();

  if (!canSell) {
    return (
      <WorkspacePageShell>
        <SellingCapabilityRequired businessName={business.name} area="listings" />
      </WorkspacePageShell>
    );
  }

  const categories = await getCategories();

  return (
    <WorkspacePageShell>
      <Link
        href={routes.dashboard.listings}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <RiArrowLeftLine className="size-3.5" aria-hidden="true" />
        Back to listings
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">New listing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Listed by <span className="font-semibold text-foreground">{business.name}</span>. Opening stock is
          recorded in your inventory history.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl border border-border bg-card p-4 shadow-2xs sm:p-6">
        <ProductForm
          categories={categories}
          mode="create"
          actions={LISTING_FORM_ACTIONS}
          successHref={routes.dashboard.listings}
        />
      </div>
    </WorkspacePageShell>
  );
}
