import type { Order } from "@/lib/types";

/**
 * Extract a display name for the business buyer.
 */
export function getBuyerName(
  order: { business?: { business_name?: string | null; full_name?: string | null } | null }
): string {
  return (
    order.business?.business_name ||
    order.business?.full_name ||
    "Business"
  );
}

/**
 * Extract a display name for the farmer/seller.
 */
export function getSellerName(
  order: { farmer?: { business_name?: string | null; full_name?: string | null } | null }
): string {
  return (
    order.farmer?.business_name ||
    order.farmer?.full_name ||
    "Local Farm"
  );
}

/**
 * Summarize order items into a compact one-line string.
 * e.g. "Tomatoes · 20 kg +2 more" or "No items"
 */
export function summarizeOrderItems(
  items?: Order["items"] | null
): string {
  if (!items || items.length === 0) return "No items";
  const first = items[0];
  const name = first.product_name ?? "Product";
  const qty = [first.quantity, first.unit].filter(Boolean).join(" ");
  const rest = items.length - 1;
  const base = `${name} · ${qty}`;
  if (rest === 0) return base;
  return `${base} +${rest} more`;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Format the age of an order as a human-readable relative string.
 * Call from server components only, or pass `now` explicitly to avoid
 * the react-hooks/purity ESLint rule.
 */
export function formatOrderAge(
  iso: string,
  now: number = Date.now()
): string {
  const created = new Date(iso).getTime();
  const diff = now - created;

  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;

  // After 7 days — short date (server-safe, no time component)
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}
