"use server";

/**
 * V4 inventory action (/dashboard/inventory).
 *
 * The only app path that changes stock. The client sends what happened
 * (received / loss / counted) and, for a count, the balance it saw. The
 * database applies it atomically under the product row lock and writes the
 * ledger row; quantity_available is never written from the client.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAction } from "@/platform/actions";
import { AppError } from "@/platform/errors";
import { requireCanSell } from "@/platform/business-context";
import { routes } from "@/platform/routes";
import { InventoryAdjustmentSchema, type InventoryAdjustmentInput } from "@/lib/validation";
import { producerOpsError } from "@/lib/producer-ops-errors";

export const adjustInventory = createAction(async (input: InventoryAdjustmentInput) => {
  const context = await requireCanSell();

  const parsed = InventoryAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message);
  }
  const adjustment = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjust_business_inventory", {
    p_business_id: context.business.id,
    p_product_id: adjustment.productId,
    p_movement_type: adjustment.type,
    p_quantity: adjustment.quantity,
    p_reason: adjustment.reason || null,
    p_expected_quantity: adjustment.type === "ADJUSTMENT" ? adjustment.expectedQuantity : null,
  });

  if (error) throw producerOpsError(error);

  revalidatePath(routes.dashboard.inventory);
  revalidatePath(routes.dashboard.listings);
  revalidatePath(routes.dashboardRoot);
  revalidatePath(routes.product(adjustment.productId));

  const result = (data ?? {}) as { quantity_available?: number; quantity_delta?: number };
  return {
    quantityAvailable: Number(result.quantity_available),
    quantityDelta: Number(result.quantity_delta),
  };
});
