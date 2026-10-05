/**
 * UMA Market V4 — Producer operations: deterministic rule verification
 *
 * TIER: deterministic. No database, no credentials, no network.
 *
 * COVERS:
 *   R-STOCK   stock-state thresholds (out / below MOQ / low / ok) used by
 *             /dashboard/listings, /dashboard/inventory and the dashboard alert
 *   R-VIEW    listing tabs, counts, search and sort
 *   R-LIST    ListingInputSchema (mirrors create/update_business_listing)
 *   R-INV     InventoryAdjustmentSchema (mirrors adjust_business_inventory)
 *   R-ERR     RPC error mapping never echoes unrecognised database text
 *
 * HOW TO RUN:
 *   npm run verify:v4-producer-ops-rules
 */

import { getStockState, formatQuantityDelta } from "../src/lib/inventory";
import {
  countListings,
  filterAndSortListings,
  toBusinessListing,
  type BusinessListing,
} from "../src/lib/listings";
import { InventoryAdjustmentSchema, ListingInputSchema } from "../src/lib/validation";
import { producerOpsError } from "../src/lib/producer-ops-errors";

let passed = 0;
let failed = 0;

function check(id: string, description: string, condition: boolean, details?: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS  [${id}] ${description}`);
  } else {
    failed++;
    console.error(`  FAIL  [${id}] ${description}${details ? `\n        ${details}` : ""}`);
  }
}

function section(title: string): void {
  console.log(`\n${"-".repeat(72)}\n  ${title}\n${"-".repeat(72)}`);
}

function firstIssue(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string {
  return result.success ? "" : (result.error?.issues[0]?.message ?? "");
}

// ── R-STOCK ──────────────────────────────────────────────────────────────────
section("R-STOCK — stock state thresholds");

const stockCases: Array<[number, number, string]> = [
  [0, 1, "out"],
  [-1, 1, "out"],
  [3, 5, "below_moq"],
  [15, 20, "below_moq"],
  [20, 20, "low"],
  [10, 2, "low"],
  [10.01, 2, "ok"],
  [21, 20, "ok"],
  [500, 5, "ok"],
];
for (const [qty, moq, expected] of stockCases) {
  const actual = getStockState(qty, moq);
  check(`R-STOCK-${qty}/${moq}`, `qty ${qty}, MOQ ${moq} → ${expected}`, actual === expected, `got ${actual}`);
}
check("R-STOCK-DELTA-1", "positive delta formats with +", formatQuantityDelta(12.5) === "+12.5");
check("R-STOCK-DELTA-2", "negative delta formats with a true minus", formatQuantityDelta(-3) === "−3");

// ── R-VIEW ───────────────────────────────────────────────────────────────────
section("R-VIEW — listing tabs, counts, search and sort");

function listing(
  id: string,
  overrides: Partial<Omit<BusinessListing, "stockState" | "needsAttention">>
): BusinessListing {
  return toBusinessListing({
    id,
    name: id,
    status: "active",
    moderation_status: "approved",
    price_per_unit: 100,
    unit: "kg",
    quantity_available: 100,
    min_order_quantity: 1,
    image_path: null,
    image_url: null,
    updated_at: "2026-10-06T00:00:00Z",
    category: { id: "c1", name: "Vegetables", slug: "vegetables" },
    ...overrides,
  });
}

const catalog: BusinessListing[] = [
  listing("Tomatoes", { quantity_available: 0 }), // live, out → attention
  listing("Kale", { quantity_available: 3, min_order_quantity: 5 }), // live, below MOQ → attention
  listing("Onions", { price_per_unit: 40 }), // live, healthy
  listing("Garlic", { status: "draft", quantity_available: 0 }), // draft, out → not attention
  listing("Flagged Basil", { status: "draft", moderation_status: "flagged" }), // under review → attention
  listing("Old Squash", { status: "archived", quantity_available: 0 }), // archived → never attention
  listing("Ginger", { status: "out_of_stock", category: { id: "c2", name: "Herbs & Spices", slug: "herbs" } }),
];

const counts = countListings(catalog);
check("R-VIEW-01", "All excludes archived", counts.all === 6, JSON.stringify(counts));
check("R-VIEW-02", "Live counts only active", counts.live === 3);
check("R-VIEW-03", "Drafts include legacy out_of_stock", counts.drafts === 3);
check("R-VIEW-04", "Needs attention = live stock problems + UMA review", counts.attention === 3);
check("R-VIEW-05", "Archived counted separately", counts.archived === 1);

const attentionNames = filterAndSortListings(catalog, { view: "attention", query: "", sort: "name" }).map((l) => l.name);
check(
  "R-VIEW-06",
  "Attention view contents",
  JSON.stringify(attentionNames) === JSON.stringify(["Flagged Basil", "Kale", "Tomatoes"]),
  JSON.stringify(attentionNames)
);
check(
  "R-VIEW-07",
  "Search matches category name, case-insensitive",
  filterAndSortListings(catalog, { view: "all", query: "HERBS", sort: "updated" }).map((l) => l.name).join() === "Ginger"
);
const byStock = filterAndSortListings(catalog, { view: "live", query: "", sort: "stock_asc" }).map((l) => l.name);
check(
  "R-VIEW-08",
  "Stock sort puts out-of-stock, then below-MOQ, first",
  JSON.stringify(byStock) === JSON.stringify(["Tomatoes", "Kale", "Onions"]),
  JSON.stringify(byStock)
);
const byPrice = filterAndSortListings(catalog, { view: "live", query: "", sort: "price_asc" }).map((l) => l.name);
check("R-VIEW-09", "Price sort ascending", byPrice[0] === "Onions", JSON.stringify(byPrice));

// ── R-LIST ───────────────────────────────────────────────────────────────────
section("R-LIST — ListingInputSchema");

const validListing = {
  name: "Benguet Strawberries",
  category_id: null,
  description: "",
  price_per_unit: 150.5,
  unit: "kg",
  min_order_quantity: 2,
  quantity_available: 100.25,
  harvest_date: "2026-10-01",
  available_until: "2026-10-20",
  status: "active" as const,
  image_paths: ["products/user_abc/1a2b.webp"],
};
check("R-LIST-01", "Valid listing (decimal stock) passes", ListingInputSchema.safeParse(validListing).success);
check(
  "R-LIST-02",
  "Zero price rejected",
  firstIssue(ListingInputSchema.safeParse({ ...validListing, price_per_unit: 0 })) === "Price must be greater than 0."
);
check(
  "R-LIST-03",
  "Three-decimal price rejected",
  firstIssue(ListingInputSchema.safeParse({ ...validListing, price_per_unit: 1.005 })) ===
    "Enter a price with up to 2 decimal places."
);
check(
  "R-LIST-04",
  "Negative opening stock rejected",
  firstIssue(ListingInputSchema.safeParse({ ...validListing, quantity_available: -1 })) ===
    "Opening stock cannot be negative."
);
check(
  "R-LIST-05",
  "More than 5 photos rejected",
  firstIssue(ListingInputSchema.safeParse({ ...validListing, image_paths: Array(6).fill("p") })) ===
    "A listing can have up to 5 photos."
);
check(
  "R-LIST-06",
  "Available-until before harvest rejected",
  firstIssue(ListingInputSchema.safeParse({ ...validListing, available_until: "2026-09-01" })) ===
    "Available-until date cannot be before the harvest date."
);
check(
  "R-LIST-07",
  "Status outside active/draft rejected (archive is a separate action)",
  !ListingInputSchema.safeParse({ ...validListing, status: "archived" }).success
);
const nanPriceIssue = firstIssue(ListingInputSchema.safeParse({ ...validListing, price_per_unit: NaN }));
check(
  "R-LIST-08",
  "NaN price gets an authored message, not a library message",
  nanPriceIssue === "Enter a price.",
  nanPriceIssue
);

// ── R-INV ────────────────────────────────────────────────────────────────────
section("R-INV — InventoryAdjustmentSchema");

const productId = "d5000003-0000-4000-8000-000000000001";
check(
  "R-INV-01",
  "Receive positive decimal quantity",
  InventoryAdjustmentSchema.safeParse({ type: "RECEIVED", productId, quantity: 12.5 }).success
);
check(
  "R-INV-02",
  "Receive zero rejected",
  firstIssue(InventoryAdjustmentSchema.safeParse({ type: "RECEIVED", productId, quantity: 0 })) ===
    "Quantity must be greater than 0."
);
check(
  "R-INV-03",
  "Loss negative rejected",
  firstIssue(InventoryAdjustmentSchema.safeParse({ type: "SPOILAGE", productId, quantity: -2 })) ===
    "Quantity cannot be negative."
);
check(
  "R-INV-04",
  "Count correction requires the balance the user saw",
  !InventoryAdjustmentSchema.safeParse({ type: "ADJUSTMENT", productId, quantity: 40 }).success
);
check(
  "R-INV-05",
  "Count correction to zero allowed",
  InventoryAdjustmentSchema.safeParse({ type: "ADJUSTMENT", productId, quantity: 0, expectedQuantity: 5 }).success
);
check(
  "R-INV-06",
  "Three decimals rejected",
  firstIssue(InventoryAdjustmentSchema.safeParse({ type: "RECEIVED", productId, quantity: 0.001 })) ===
    "Enter a quantity with up to 2 decimal places."
);
check(
  "R-INV-07",
  "Unknown movement type (e.g. SOLD from a client) rejected with an authored message",
  firstIssue(InventoryAdjustmentSchema.safeParse({ type: "SOLD", productId, quantity: 5 })) ===
    "Choose a valid stock action."
);
check(
  "R-INV-08",
  "Invalid product id rejected",
  firstIssue(InventoryAdjustmentSchema.safeParse({ type: "RECEIVED", productId: "x", quantity: 1 })) ===
    "Invalid listing."
);

// ── R-ERR ────────────────────────────────────────────────────────────────────
section("R-ERR — database error mapping");

const v = producerOpsError({ code: "UMV01", message: "Price must be greater than 0." });
check("R-ERR-01", "UMV01 → VALIDATION with the authored message", v.code === "VALIDATION" && v.message === "Price must be greater than 0.");
const c = producerOpsError({ code: "UMC01", message: "Stock changed to 40 kg since you opened this form." });
check("R-ERR-02", "UMC01 → CONFLICT with the authored message", c.code === "CONFLICT" && c.message.startsWith("Stock changed"));
const n = producerOpsError({ code: "UMN01", message: "Listing not found in this business." });
check("R-ERR-03", "UMN01 → NOT_FOUND", n.code === "NOT_FOUND");
const a = producerOpsError({ code: "42501", message: "Not a member of the specified business" });
check("R-ERR-04", "42501 → UNAUTHORIZED without echoing SQL text", a.code === "UNAUTHORIZED" && !a.message.includes("specified business"));
const m = producerOpsError({ code: "P0001", message: "Product is under moderation review and cannot be activated" });
check("R-ERR-05", "Moderation trigger → CONFLICT", m.code === "CONFLICT" && m.message.includes("under review"));
const k = producerOpsError({
  code: "23514",
  message: 'new row for relation "products" violates check constraint "products_active_requires_approval"',
});
check("R-ERR-06", "Moderation CHECK → CONFLICT without constraint name", k.code === "CONFLICT" && !k.message.includes("products_"));
const u = producerOpsError({ code: "42P01", message: 'relation "public.secret_table" does not exist' });
check("R-ERR-07", "Unknown error → INTERNAL generic", u.code === "INTERNAL" && !u.message.includes("secret_table"));
const p = producerOpsError({ code: "P0001", message: "some other raise with internals" });
check("R-ERR-08", "Unrecognised P0001 → INTERNAL generic", p.code === "INTERNAL" && !p.message.includes("internals"));

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(72)}\n  ${passed} passed, ${failed} failed\n${"=".repeat(72)}`);
process.exit(failed === 0 ? 0 : 1);
