"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiArchiveLine,
  RiEdit2Line,
  RiExternalLinkLine,
  RiEyeLine,
  RiEyeOffLine,
  RiInboxUnarchiveLine,
  RiLoaderLine,
  RiMore2Fill,
  RiStackLine,
} from "@remixicon/react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { setListingStatus } from "@/app/dashboard/listings/actions";
import { routes } from "@/platform/routes";
import type { ProductStatus } from "@/lib/constants";
import type { ModerationStatus } from "@/lib/listings";
import { cn } from "@/lib/utils";

interface ListingRowActionsProps {
  productId: string;
  name: string;
  status: ProductStatus;
  moderationStatus: ModerationStatus;
}

const SUCCESS_COPY: Record<"active" | "draft" | "archived", string> = {
  active: "Listing published.",
  draft: "Listing moved to drafts.",
  archived: "Listing archived.",
};

export function ListingRowActions({ productId, name, status, moderationStatus }: ListingRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isModerated = moderationStatus !== "approved";
  const isArchived = status === "archived";

  function changeStatus(next: "active" | "draft" | "archived", successCopy = SUCCESS_COPY[next]) {
    startTransition(async () => {
      const result = await setListingStatus(productId, next);
      if (result.success) {
        toast.success(successCopy);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="listing-row-actions">
      <Link
        href={routes.dashboard.editListing(productId)}
        className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-9 sm:h-7")}
        aria-label={`Edit ${name}`}
      >
        <RiEdit2Line className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Edit</span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-9 sm:size-7"
              disabled={isPending}
              aria-label={`More actions for ${name}`}
              data-testid="listing-more-actions"
            />
          }
        >
          {isPending ? (
            <RiLoaderLine className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <RiMore2Fill className="size-4" aria-hidden="true" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {status === "active" ? (
            <DropdownMenuItem onClick={() => changeStatus("draft")}>
              <RiEyeOffLine aria-hidden="true" />
              Unpublish (move to drafts)
            </DropdownMenuItem>
          ) : !isArchived ? (
            <DropdownMenuItem disabled={isModerated} onClick={() => changeStatus("active")}>
              <RiEyeLine aria-hidden="true" />
              {isModerated ? "Publish (blocked by UMA review)" : "Publish"}
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem onClick={() => router.push(`${routes.dashboard.inventory}#stock-${productId}`)}>
            <RiStackLine aria-hidden="true" />
            Update stock
          </DropdownMenuItem>

          {status === "active" && (
            <DropdownMenuItem onClick={() => router.push(routes.product(productId))}>
              <RiExternalLinkLine aria-hidden="true" />
              View in marketplace
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {isArchived ? (
            <DropdownMenuItem onClick={() => changeStatus("draft", "Listing restored to drafts.")}>
              <RiInboxUnarchiveLine aria-hidden="true" />
              Restore to drafts
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onClick={() => changeStatus("archived")}>
              <RiArchiveLine aria-hidden="true" />
              Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
