/**
 * UMA V4 — Producer operations error mapping (/dashboard/listings, /dashboard/inventory)
 *
 * The listing and inventory RPCs raise stable SQLSTATEs (migration
 * 20261006100000_v4_producer_listings_inventory.sql):
 *
 *   UMV01  validation      message authored in SQL, safe to show
 *   UMC01  state conflict  message authored in SQL, safe to show
 *   UMN01  not in business fixed message
 *   42501  not allowed     fixed message
 *
 * Anything else becomes INTERNAL with the generic message; the raw database
 * text is kept only in the server-side log context.
 */

import { AppError } from "@/platform/errors";

export interface ProducerOpsDbError {
  code?: string | null;
  message?: string | null;
}

const MODERATION_MESSAGE =
  "This listing is under review by UMA and can't be published until the review is resolved.";

export function producerOpsError(error: ProducerOpsDbError): AppError {
  const message = error.message ?? "";
  const context = { dbCode: error.code ?? null, dbMessage: message };

  switch (error.code) {
    case "UMV01":
      return new AppError("VALIDATION", message || undefined, context);
    case "UMC01":
      return new AppError("CONFLICT", message || undefined, context);
    case "UMN01":
      return new AppError("NOT_FOUND", "This listing isn't part of your active business.", context);
    case "42501":
      return new AppError(
        "UNAUTHORIZED",
        "You don't have permission to manage listings for this business.",
        context,
      );
    // Moderation invariants enforced below the RPCs (trigger + CHECK).
    case "P0001":
      if (message.includes("under moderation review")) {
        return new AppError("CONFLICT", MODERATION_MESSAGE, context);
      }
      break;
    case "23514":
      if (message.includes("products_active_requires_approval")) {
        return new AppError("CONFLICT", MODERATION_MESSAGE, context);
      }
      if (message.includes("quantity_available")) {
        return new AppError("CONFLICT", "Stock can't go below zero.", context);
      }
      break;
  }

  return new AppError("INTERNAL", undefined, context);
}
