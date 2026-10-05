import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { RiArchiveLine, RiArrowLeftLine, RiShieldLine } from "@remixicon/react";
import { WorkspacePageShell } from "@/components/dashboard/workspace-page-shell";
import { SellingCapabilityRequired } from "@/components/dashboard/selling-capability-required";
import { ProductForm } from "@/components/dashboard/product-form";
import { ProductStatusBadge } from "@/components/dashboard/product-status-badge";
import { ModerationBadge } from "@/components/dashboard/listings/moderation-badge";
import { getCategories } from "@/lib/supabase/queries/products";
import { getBusinessListingForEdit } from "@/lib/supabase/queries/listings";
import { routes } from "@/platform/routes";
import { requireWorkspaceBusiness } from "../../../_lib/require-workspace-business";
import { LISTING_FORM_ACTIONS } from "../../listing-form-actions";

export const metadata: Metadata = {
  title: "Edit listing — UMA Market",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({ params }: PageProps) {
  const { business, canSell } = await requireWorkspaceBusiness();

  if (!canSell) {
    return (
      <WorkspacePageShell>
        <SellingCapabilityRequired businessName={business.name} area="listings" />
      </WorkspacePageShell>
    );
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  // Scoped to the active business: another business's listing resolves to 404.
  const [listing, categories] = await Promise.all([
    getBusinessListingForEdit(business.id, id),
    getCategories(),
  ]);
  if (!listing) notFound();

  const isModerated = listing.moderation_status !== "approved";

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
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{listing.name}</h1>
          <ProductStatusBadge status={listing.status} />
          <ModerationBadge status={listing.moderation_status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the details buyers see. Stock is managed in{" "}
          <Link href={routes.dashboard.inventory} className="font-medium text-primary hover:underline">
            Inventory
          </Link>
          .
        </p>
      </div>

      {isModerated && (
        <div
          role="status"
          data-testid="moderation-notice"
          className="flex max-w-2xl items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm"
        >
          <RiShieldLine className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-foreground">
            UMA is reviewing this listing. You can still edit its details, but it can&apos;t be published until
            the review is resolved.
          </p>
        </div>
      )}

      {listing.status === "archived" && (
        <div
          role="status"
          className="flex max-w-2xl items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm"
        >
          <RiArchiveLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-foreground">
            This listing is archived. Saving keeps it archived — restore it from Listings to sell it again.
          </p>
        </div>
      )}

      <div className="max-w-2xl rounded-xl border border-border bg-card p-4 shadow-2xs sm:p-6">
        <ProductForm
          categories={categories}
          mode="edit"
          product={listing}
          actions={LISTING_FORM_ACTIONS}
          successHref={routes.dashboard.listings}
        />
      </div>
    </WorkspacePageShell>
  );
}
