/**
 * UMA V4 — Inventory rules shared by /dashboard/listings and /dashboard/inventory.
 *
 * Pure and deterministic (no I/O). The database is the authority for stock:
 * products.quantity_available is the balance and public.inventory_movements is
 * the ledger. These helpers only classify and describe what it returns.
 */

export const INVENTORY_MOVEMENT_TYPES = [
  "OPENING",
  "RECEIVED",
  "SOLD",
  "RELEASED",
  "SPOILAGE",
  "ADJUSTMENT",
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

/** Movements a producer records directly (adjust_business_inventory). */
export type InventoryAction = Extract<InventoryMovementType, "RECEIVED" | "SPOILAGE" | "ADJUSTMENT">;

export const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  OPENING: "Opening stock",
  RECEIVED: "Stock received",
  SOLD: "Sold",
  RELEASED: "Returned from cancelled order",
  SPOILAGE: "Loss or spoilage",
  ADJUSTMENT: "Count correction",
};

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name: string | null;
  unit: string | null;
  movement_type: InventoryMovementType;
  quantity_delta: number;
  balance_after: number;
  reason: string | null;
  reference_type: "order" | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}

export function isInventoryMovementType(value: string): value is InventoryMovementType {
  return (INVENTORY_MOVEMENT_TYPES as readonly string[]).includes(value);
}

// ── Stock state ──────────────────────────────────────────────────────────────

/**
 * out        nothing on hand
 * below_moq  on hand, but less than the minimum order — checkout rejects every order
 * low        at or under the low-stock line
 * ok         healthy
 */
export type StockState = "out" | "below_moq" | "low" | "ok";

/** Low-stock line used by the V4 dashboard alert: max(10, MOQ). */
export const LOW_STOCK_FLOOR = 10;

export function getStockState(quantity: number, minOrderQuantity: number): StockState {
  if (quantity <= 0) return "out";
  if (quantity < minOrderQuantity) return "below_moq";
  if (quantity <= Math.max(LOW_STOCK_FLOOR, minOrderQuantity)) return "low";
  return "ok";
}

/** Lower sorts first: what needs fixing comes before what is healthy. */
export const STOCK_STATE_PRIORITY: Record<StockState, number> = {
  out: 0,
  below_moq: 1,
  low: 2,
  ok: 3,
};

export const STOCK_STATE_LABELS: Record<StockState, string> = {
  out: "Out of stock",
  below_moq: "Below minimum order",
  low: "Low stock",
  ok: "In stock",
};

export function formatQuantity(value: number): string {
  return value.toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

/** "+12.5", "−3" — signed, with a true minus sign for screen readers and print. */
export function formatQuantityDelta(value: number): string {
  const magnitude = formatQuantity(Math.abs(value));
  return value > 0 ? `+${magnitude}` : `−${magnitude}`;
}
