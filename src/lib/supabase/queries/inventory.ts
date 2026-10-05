import { createClient } from "@/lib/supabase/server";
import { isInventoryMovementType, type InventoryMovement } from "@/lib/inventory";

/**
 * V4 inventory ledger reads. RLS ("inventory_movements: seller members read")
 * limits rows to active SELL businesses the caller belongs to; `businessId`
 * must come from the server-validated active business context.
 */

const RECENT_MOVEMENT_LIMIT = 20;

export async function getRecentInventoryMovements(
  businessId: string,
  limit: number = RECENT_MOVEMENT_LIMIT
): Promise<InventoryMovement[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory_movements")
    .select(
      `
      id, product_id, movement_type, quantity_delta, balance_after, reason,
      reference_type, reference_id, created_by, created_at,
      product:products(name, unit)
    `
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? [])
    .filter((row) => isInventoryMovementType(row.movement_type))
    .map((row) => ({
      id: row.id,
      product_id: row.product_id,
      product_name: row.product?.name ?? null,
      unit: row.product?.unit ?? null,
      movement_type: row.movement_type as InventoryMovement["movement_type"],
      quantity_delta: Number(row.quantity_delta),
      balance_after: Number(row.balance_after),
      reason: row.reason,
      reference_type: row.reference_type === "order" ? "order" : null,
      reference_id: row.reference_id,
      created_by: row.created_by,
      created_at: row.created_at,
    }));
}
