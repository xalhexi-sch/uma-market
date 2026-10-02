// =============================================================================
// UMA Market — Checkout Error Mapping & Field Routing Verification Suite
//
// STATIC / PURE SUITE — no network, no database, no auth, no mutation.
// Safe to run anywhere: npx tsx scripts/verify-checkout-errors.ts
//
// Guards two regressions:
//   1. The farmerClerkId root-cause bug: validating a flattened { items } object
//      against PlaceOrderSchema must FAIL, while validating the real per-order
//      group shape must SUCCEED.
//   2. Error leakage: no mapped customer-facing message may ever contain
//      validation-library or database internals.
//
// Exit code 0 = all assertions passed.
// =============================================================================

import { PlaceOrderSchema } from "../src/lib/validation";
import {
  checkoutError,
  genericCheckoutError,
  mapCheckoutDatabaseError,
  mapCheckoutSchemaIssue,
} from "../src/lib/checkout-errors";
import type { CheckoutError } from "../src/lib/checkout-errors";

let passed = 0;
let failed = 0;

function check(id: string, name: string, condition: boolean, detail: string): void {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${id.padEnd(10)} ${name}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${id.padEnd(10)} ${name}`);
    console.log(`           >> ${detail}`);
  }
}

function section(title: string): void {
  console.log(`\n${"=".repeat(74)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(74));
}

const VALID_PRODUCT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

/** Mirrors the payload checkout-form.tsx builds for a valid single-farmer cart. */
function validOrderGroup(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    farmerClerkId: "user_2abcFarmer",
    fulfillmentType: "pickup" as const,
    pickupDate: "2026-10-15",
    notes: "yes",
    items: [{ product_id: VALID_PRODUCT_ID, quantity: 5 }],
    ...overrides,
  };
}

// =============================================================================
section("SECTION 1 — Root-cause regression: farmerClerkId per-order validation");
// =============================================================================

const realGroup = validOrderGroup();
const realParse = PlaceOrderSchema.safeParse(realGroup);
check(
  "RG-1",
  "Corrected shape (full per-order group) PASSES PlaceOrderSchema",
  realParse.success,
  realParse.success ? "" : JSON.stringify(realParse.error.issues)
);

// The exact pre-fix payload: only `items`, farmerClerkId/fulfillmentType omitted.
const buggyShape = { items: realGroup.items };
const buggyParse = PlaceOrderSchema.safeParse(buggyShape);
check(
  "RG-2",
  "Buggy shape ({ items } only) FAILS PlaceOrderSchema",
  !buggyParse.success,
  "Expected the buggy shape to fail; it unexpectedly passed"
);

const buggyIssue = buggyParse.success ? undefined : buggyParse.error.issues[0];
check(
  "RG-3",
  "Buggy shape fails on path ['farmerClerkId']",
  Array.isArray(buggyIssue?.path) && buggyIssue?.path[0] === "farmerClerkId",
  `Got path: ${JSON.stringify(buggyIssue?.path)}`
);

const ZOD_LEAK = "Invalid input: expected string, received undefined";
check(
  "RG-4",
  "Buggy shape reproduces the exact production error text",
  buggyIssue?.message === ZOD_LEAK,
  `Got: ${buggyIssue?.message}`
);

// The mapped error for that issue must NOT carry the Zod text.
const mappedBuggy = mapCheckoutSchemaIssue(buggyIssue);
check(
  "RG-5",
  "Mapped error for the root-cause bug does NOT leak the Zod message",
  !mappedBuggy.message.includes(ZOD_LEAK),
  `Leaked: ${mappedBuggy.message}`
);
check(
  "RG-6",
  "Mapped error for the root-cause bug falls back to the generic message",
  mappedBuggy.code === "GENERIC" && mappedBuggy.field === undefined,
  `Got code=${mappedBuggy.code} field=${String(mappedBuggy.field)}`
);

// Every fulfillment/notes combination a customer can actually produce must pass.
const CUSTOMER_REACHABLE: Array<[string, Record<string, unknown>]> = [
  ["Pickup + date + notes", { fulfillmentType: "pickup", pickupDate: "2026-10-15", notes: "yes" }],
  ["Pickup + date, no notes", { fulfillmentType: "pickup", pickupDate: "2026-10-15", notes: undefined }],
  ["Pickup + date, empty notes", { fulfillmentType: "pickup", pickupDate: "2026-10-15", notes: "" }],
  ["Seller delivery + address", { fulfillmentType: "seller_delivery", deliveryAddress: "123 Market St", pickupDate: undefined, notes: undefined }],
];

for (const [label, overrides] of CUSTOMER_REACHABLE) {
  const parsed = PlaceOrderSchema.safeParse(validOrderGroup(overrides));
  check("RG-7", `Customer-reachable case passes schema: ${label}`, parsed.success,
    parsed.success ? "" : JSON.stringify(parsed.error.issues));
}

// =============================================================================
section("SECTION 2 — Schema issue -> customer-safe error mapping");
// =============================================================================

// Build the real issue objects by deliberately failing the parse.
function firstIssue(payload: unknown) {
  const parsed = PlaceOrderSchema.safeParse(payload);
  return parsed.success ? undefined : parsed.error.issues[0];
}

// NOTE: PlaceOrderSchema declares pickupDate as z.string().optional(), so an
// omitted pickup date passes the schema by design. The "pickup date required"
// rule is enforced separately by validatePickupDate() in actions.ts, which
// returns the PICKUP_DATE_REQUIRED code. This asserts both halves of that split
// so the rule cannot be silently dropped from either side.

// (a) Schema layer must not reject a customer-reachable payload without a date.
const schemaAllowsMissingDate = PlaceOrderSchema.safeParse(
  validOrderGroup({ pickupDate: undefined })
).success;
check("SM-1", "Schema layer tolerates an omitted pickupDate (validated elsewhere)",
  schemaAllowsMissingDate,
  "PlaceOrderSchema unexpectedly rejected a customer-reachable payload");

// (b) validatePickupDate() is the authority for the required rule. It is
// exercised end-to-end via the security-test RPC suite (verify-pickup-date.ts);
// here we assert the code it returns carries the right customer-facing contract.
const requiredFromDateRule = checkoutError("PICKUP_DATE_REQUIRED");
check("SM-2", "Pickup-date-required error anchors to the pickupDate field",
  requiredFromDateRule.code === "PICKUP_DATE_REQUIRED" && requiredFromDateRule.field === "pickupDate",
  `Got ${JSON.stringify(requiredFromDateRule)}`);
check("SM-2b", "Pickup-date-required message is 'Please select a pickup date.'",
  requiredFromDateRule.message === "Please select a pickup date.",
  `Got: ${requiredFromDateRule.message}`);

// (c) A non-string pickupDate reaching the schema must still map safely.
const nonStringPickup = mapCheckoutSchemaIssue(
  firstIssue(validOrderGroup({ pickupDate: 12345 as unknown as string }))
);
check("SM-2c", "Non-string pickupDate maps to a pickupDate-anchored error, not raw internals",
  nonStringPickup.field === "pickupDate" && !nonStringPickup.message.includes("Invalid input"),
  `Got ${JSON.stringify(nonStringPickup)}`);

const badAddress = mapCheckoutSchemaIssue(
  firstIssue(validOrderGroup({ fulfillmentType: "seller_delivery", deliveryAddress: "x".repeat(501) }))
);
check("SM-3", "Over-long deliveryAddress maps to DELIVERY_ADDRESS_REQUIRED + deliveryAddress field",
  badAddress.code === "DELIVERY_ADDRESS_REQUIRED" && badAddress.field === "deliveryAddress",
  `Got ${JSON.stringify(badAddress)}`);

const badItemQty = mapCheckoutSchemaIssue(
  firstIssue(validOrderGroup({ items: [{ product_id: VALID_PRODUCT_ID, quantity: 0 }] }))
);
check("SM-4", "Bad item quantity maps to QUANTITY_UNAVAILABLE (no field)",
  badItemQty.code === "QUANTITY_UNAVAILABLE" && badItemQty.field === undefined,
  `Got ${JSON.stringify(badItemQty)}`);

const badProductId = mapCheckoutSchemaIssue(
  firstIssue(validOrderGroup({ items: [{ product_id: "not-a-uuid", quantity: 1 }] }))
);
check("SM-5", "Bad product_id maps to PRODUCT_UNAVAILABLE (no field)",
  badProductId.code === "PRODUCT_UNAVAILABLE" && badProductId.field === undefined,
  `Got ${JSON.stringify(badProductId)}`);

const badFulfillment = mapCheckoutSchemaIssue(
  firstIssue(validOrderGroup({ fulfillmentType: "teleport" }))
);
check("SM-6", "Bad fulfillmentType maps to GENERIC (never echoes enum internals)",
  badFulfillment.code === "GENERIC",
  `Got ${JSON.stringify(badFulfillment)}`);

// =============================================================================
section("SECTION 3 — Database / PostgREST error mapping");
// =============================================================================

const DB_CASES: Array<[string, string, string]> = [
  ["DB-1", "Pickup date is required for pickup orders", "PICKUP_DATE_REQUIRED"],
  ["DB-2", "Pickup date cannot be in the past", "PICKUP_DATE_PAST"],
  ["DB-3", "Pickup date cannot be in the past", "PICKUP_DATE_PAST"],
  ["DB-4", `Cart item for product "Kangkong" was not found or has already been checked out.`, "CART_CONFLICT"],
  ["DB-5", `Cart item for product "Kangkong" was already checked out or removed.`, "CART_CONFLICT"],
  ["DB-6", "Requested quantity (99) exceeds quantity in cart (5).", "CART_CONFLICT"],
  ["DB-7", "Order group must contain at least one item", "CART_CONFLICT"],
  ["DB-8", "Product Kangkong is not available for ordering", "PRODUCT_UNAVAILABLE"],
  ["DB-9", "Product not found: 3f2504e0-4f89-41d3-9a0c-0305e82c3301", "PRODUCT_UNAVAILABLE"],
  ["DB-10", "Insufficient stock for \"Kangkong\" — available: 2 kg", "QUANTITY_UNAVAILABLE"],
  ["DB-11", "Minimum order for \"Kangkong\" is 5 kg", "QUANTITY_UNAVAILABLE"],
  ["DB-12", "Product Kangkong does not belong to the specified farmer", "PRODUCT_UNAVAILABLE"],
  ["DB-13", "Item quantity must be greater than zero", "QUANTITY_UNAVAILABLE"],
  ["DB-14", "Only business users can place orders", "UNAUTHORIZED"],
  ["DB-15", "Not authenticated", "UNAUTHORIZED"],
  ["DB-16", "Account is suspended and cannot place orders", "ACCOUNT_INACTIVE"],
];

for (const [id, raw, expectedCode] of DB_CASES) {
  const mapped = mapCheckoutDatabaseError(raw);
  check(id, `"${raw.slice(0, 52)}" -> ${expectedCode}`, mapped.code === expectedCode,
    `Got ${JSON.stringify(mapped)}`);
}

const pastDate = mapCheckoutDatabaseError("Pickup date cannot be in the past");
check("DB-17", "Past pickup date carries the pickupDate field anchor",
  pastDate.field === "pickupDate", `Got field=${String(pastDate.field)}`);
check("DB-18", "Past pickup date message is customer-safe wording",
  pastDate.message === "Pickup date cannot be in the past.", `Got: ${pastDate.message}`);

// Unrecognised / hostile inputs must all collapse to GENERIC.
const HOSTILE: Array<[string, string | null | undefined]> = [
  ["DB-19", "relation \"public.orders\" does not exist"],
  ["DB-20", "JWT expired"],
  ["DB-21", "permission denied for function place_checkout_orders"],
  ["DB-22", "Invalid input: expected string, received undefined"],
  ["DB-23", "at Object.<anonymous> (actions.ts:110:5)"],
  ["DB-24", ""],
  ["DB-25", null],
  ["DB-26", undefined],
];

for (const [id, raw] of HOSTILE) {
  const mapped = mapCheckoutDatabaseError(raw);
  check(id, `Hostile/empty input collapses to GENERIC: ${JSON.stringify(raw)?.slice(0, 44)}`,
    mapped.code === "GENERIC" && mapped.message === genericCheckoutError().message,
    `Got ${JSON.stringify(mapped)}`);
}

// =============================================================================
section("SECTION 4 — No mapped message may leak internals");
// =============================================================================

const ALL_MESSAGES: CheckoutError[] = [
  ...DB_CASES.map(([, raw]) => mapCheckoutDatabaseError(raw)),
  ...CUSTOMER_REACHABLE.map(([, o]) => mapCheckoutSchemaIssue(firstIssue(validOrderGroup(o)))),
  requiredFromDateRule, nonStringPickup, badAddress, badItemQty, badProductId, badFulfillment,
  genericCheckoutError(),
  checkoutError("PICKUP_DATE_REQUIRED"),
  checkoutError("PICKUP_DATE_PAST"),
  checkoutError("PICKUP_DATE_INVALID"),
  checkoutError("DELIVERY_ADDRESS_REQUIRED"),
  ...HOSTILE.map(([, raw]) => mapCheckoutDatabaseError(raw)),
];

const FORBIDDEN = [
  "Invalid input:",
  "received undefined",
  "expected string",
  "Zod",
  "zod",
  "issue",
  "path",
  "safeParse",
  "JSON",
  "at Object",
  "ECONNREFUSED",
  "postgres",
  "supabase",
  "PostgREST",
  "rpc",
  "SQL",
  "stack",
];

const leaks = ALL_MESSAGES.filter((e) =>
  FORBIDDEN.some((token) => e.message.toLowerCase().includes(token.toLowerCase()))
);
check("LK-1", `No message leaks internals (${ALL_MESSAGES.length} messages checked)`,
  leaks.length === 0,
  leaks.map((e) => e.message).join(" | "));

const unknownCodes = ALL_MESSAGES.filter((e) => !e.code || !e.message);
check("LK-2", "Every error has a code and a non-empty message",
  unknownCodes.length === 0, `${unknownCodes.length} malformed`);

const wrongField = ALL_MESSAGES.filter((e) => {
  if (e.code === "PICKUP_DATE_REQUIRED" || e.code === "PICKUP_DATE_PAST" || e.code === "PICKUP_DATE_INVALID") {
    return e.field !== "pickupDate";
  }
  if (e.code === "DELIVERY_ADDRESS_REQUIRED") return e.field !== "deliveryAddress";
  return false;
});
check("LK-3", "Field codes carry the correct field anchor",
  wrongField.length === 0, wrongField.map((e) => e.code).join(", "));

// =============================================================================
section("SECTION 5 — actions.ts integrity (root-cause fix still in place)");
// =============================================================================

// Read the action source to assert the per-order validation loop survived and the
// flatMap-of-items anti-pattern was not reintroduced.
import * as fs from "fs";
import * as path from "path";

const actionsSrc = fs
  .readFileSync(
    path.resolve(process.cwd(), "src/app/(dashboard)/business/checkout/actions.ts"),
    "utf-8"
  )
  .replace(/\r\n/g, "\n");

check(
  "AC-1",
  "actions.ts validates each order group individually",
  actionsSrc.includes("for (const order of orders)") &&
    actionsSrc.includes("PlaceOrderSchema.safeParse(order)"),
  "Per-order validation loop not found"
);
check(
  "AC-2",
  "actions.ts does NOT validate a flattened { items } object",
  !actionsSrc.includes("safeParse({ items:") && !actionsSrc.includes("orders.flatMap"),
  "Flat-map anti-pattern reintroduced"
);
check(
  "AC-3",
  "actions.ts maps schema issues by path, never by raw message",
  actionsSrc.includes("mapCheckoutSchemaIssue(parsed.error.issues[0])") &&
    !actionsSrc.includes("parsed.error.issues[0]?.message"),
  "Raw Zod message may still be surfaced"
);
check(
  "AC-4",
  "actions.ts maps database errors through the mapping layer",
  actionsSrc.includes("mapCheckoutDatabaseError(error.message)") &&
    !actionsSrc.includes("mapCheckoutError("),
  "Raw DB error may still be surfaced"
);
check(
  "AC-5",
  "actions.ts no longer returns the raw 'Unauthorized' string",
  !actionsSrc.includes('error: "Unauthorized"'),
  "Raw Unauthorized string still present"
);
check(
  "AC-6",
  "Pickup date rules preserved (past-date rejection intact)",
  actionsSrc.includes("Pickup date cannot be in the past") ||
    actionsSrc.includes('checkoutError("PICKUP_DATE_PAST")'),
  "Past-date rule missing"
);

// Checkout form integrity.
const formSrc = fs
  .readFileSync(path.resolve(process.cwd(), "src/components/dashboard/checkout-form.tsx"), "utf-8")
  .replace(/\r\n/g, "\n");

check(
  "FM-1",
  "Checkout form keeps the native date input with min=today",
  formSrc.includes('type="date"') && formSrc.includes("min={today}"),
  "Native date input or min={today} lost"
);
check(
  "FM-2",
  "Checkout form keeps ISO YYYY-MM-DD state (no Date object state)",
  /useState\(""\)/.test(formSrc) && !/setPickupDate\(new Date/.test(formSrc),
  "pickupDate state is no longer a plain ISO string"
);
check(
  "FM-3",
  "Checkout form routes server errors through the mapping layer",
  formSrc.includes("applyServerError"),
  "applyServerError not used"
);
check(
  "FM-4",
  "Checkout form renders field-level pickup-date error",
  formSrc.includes("pickup-date-error") && formSrc.includes("pickupDateError.message"),
  "Inline pickup-date error missing"
);
check(
  "FM-5",
  "Checkout form renders field-level delivery-address error",
  formSrc.includes("delivery-address-error") && formSrc.includes("deliveryAddressError.message"),
  "Inline delivery-address error missing"
);
check(
  "FM-6",
  "Checkout form does not render raw result.error as a string",
  !formSrc.includes("{result.error}") && !formSrc.includes("{error}"),
  "Raw error rendered directly"
);

// Past-date rejection is enforced on BOTH sides: the native widget blocks it via
// min={today}, and the server re-validates independently. Assert both, so the
// rule cannot be lost behind client-side-only protection.
check(
  "FM-8",
  "Pickup date input keeps min={today} (widget blocks past dates)",
  /id="pickup-date"[\s\S]*?type="date"[\s\S]*?min=\{today\}/.test(formSrc),
  "min={today} guard missing from the pickup date input"
);
check(
  "AC-7",
  "Server re-validates pickup dates independently of the UI guard",
  actionsSrc.includes('if (o.fulfillmentType === "pickup")') &&
    actionsSrc.includes("const dateError = validatePickupDate(o.pickupDate)"),
  "Server-side pickup date validation loop is missing"
);
check(
  "AC-8",
  "Pickup date comparison uses the Asia/Manila calendar day",
  actionsSrc.includes('timeZone: "Asia/Manila"'),
  "Asia/Manila timezone basis lost in actions.ts"
);
check(
  "FM-7",
  "Checkout form wraps the server call in try/catch",
  formSrc.includes("try {") && formSrc.includes("catch {"),
  "Server call is not guarded"
);

// Native constraint validation blocks submit BEFORE handleSubmit runs, which
// would show the browser's generic bubble instead of our styled field message.
check(
  "FM-9",
  "Form sets noValidate so our own field messages are authoritative",
  /<form[^>]*noValidate/.test(formSrc),
  "noValidate missing — native validation would swallow the submit"
);
check(
  "FM-10",
  "pickup date input keeps the required + min={today} semantics",
  /id="pickup-date"[\s\S]*?type="date"[\s\S]*?min=\{today\}[\s\S]*?required/.test(formSrc),
  "required/min semantics lost from the pickup date input"
);
check(
  "FM-11",
  "delivery address input keeps the required attribute",
  /id="delivery-address"[\s\S]*?required/.test(formSrc),
  "required attribute lost from the delivery address input"
);

// =============================================================================
section("SUMMARY");
// =============================================================================

console.log(`\n  TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);