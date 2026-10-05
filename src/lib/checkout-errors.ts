/**
 * UMA Market — Checkout error mapping layer
 *
 * Single source of truth for every customer-facing message the checkout flow can
 * emit. Raw validation-library output (Zod issue messages), database/PostgREST
 * error text and RPC RAISE messages must never be passed through to the browser.
 *
 * Rules:
 *   - Every raw/internal error is mapped to a stable {@link CheckoutErrorCode}.
 *   - Anything not explicitly recognised collapses to GENERIC.
 *   - `message` is always safe to render directly in the UI.
 *   - `field` marks errors that belong next to a specific input so the form can
 *     show them inline instead of as a form-level banner.
 */

export type CheckoutErrorField = "pickupDate" | "deliveryAddress";

export type CheckoutErrorCode =
  // Field-level
  | "PICKUP_DATE_REQUIRED"
  | "PICKUP_DATE_PAST"
  | "PICKUP_DATE_INVALID"
  | "DELIVERY_ADDRESS_REQUIRED"
  // Form-level, expected
  | "EMPTY_CART"
  | "CART_CONFLICT"
  | "PRODUCT_UNAVAILABLE"
  | "QUANTITY_UNAVAILABLE"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "ACCOUNT_INACTIVE"
  // Catch-all
  | "GENERIC";

export interface CheckoutError {
  code: CheckoutErrorCode;
  /** Customer-safe text. Never contains validation-library or database output. */
  message: string;
  /** Present when the failure is attributable to a specific form field. */
  field?: CheckoutErrorField;
}

const DEFAULT_MESSAGES: Record<CheckoutErrorCode, string> = {
  PICKUP_DATE_REQUIRED: "Please select a pickup date.",
  PICKUP_DATE_PAST: "Pickup date cannot be in the past.",
  PICKUP_DATE_INVALID: "Please select a valid pickup date.",
  DELIVERY_ADDRESS_REQUIRED: "Please enter a delivery address.",
  EMPTY_CART: "Your cart is empty.",
  CART_CONFLICT:
    "Your cart was modified or already checked out in another window. Please review your cart before placing an order.",
  PRODUCT_UNAVAILABLE: "One or more items in your cart are no longer available. Please review your cart.",
  QUANTITY_UNAVAILABLE:
    "One or more items in your cart are no longer available in the requested quantity. Please review your cart.",
  RATE_LIMITED: "Too many checkout attempts. Please wait a moment and try again.",
  UNAUTHORIZED: "Please sign in again to continue with your order.",
  ACCOUNT_INACTIVE: "Your account cannot place orders right now. Please contact support.",
  GENERIC: "Something went wrong while placing your order. Please try again.",
};

const FIELD_BY_CODE: Partial<Record<CheckoutErrorCode, CheckoutErrorField>> = {
  PICKUP_DATE_REQUIRED: "pickupDate",
  PICKUP_DATE_PAST: "pickupDate",
  PICKUP_DATE_INVALID: "pickupDate",
  DELIVERY_ADDRESS_REQUIRED: "deliveryAddress",
};

/** Shown whenever a failure cannot be safely attributed or explained. */
export const GENERIC_CHECKOUT_ERROR: CheckoutError = {
  code: "GENERIC",
  message: DEFAULT_MESSAGES.GENERIC,
};

/** Build a customer-safe checkout error. */
export function checkoutError(code: CheckoutErrorCode, message?: string): CheckoutError {
  const field = FIELD_BY_CODE[code];
  return { code, message: message ?? DEFAULT_MESSAGES[code], ...(field ? { field } : {}) };
}

export function genericCheckoutError(): CheckoutError {
  return { ...GENERIC_CHECKOUT_ERROR };
}

/**
 * Maps a raw `place_checkout_orders` / `place_order` RPC or PostgREST error
 * message to a customer-safe error.
 *
 * Matching is substring-based and ordered from most specific to least specific.
 * Unrecognised input always resolves to GENERIC — never echoed back.
 */
export function mapCheckoutDatabaseError(raw: string | null | undefined): CheckoutError {
  if (!raw) return genericCheckoutError();
  const msg = raw.toLowerCase();

  // Cart integrity / concurrency races.
  if (
    msg.includes("was not found or has already been checked out") ||
    msg.includes("was already checked out") ||
    msg.includes("already checked out or removed") ||
    msg.includes("exceeds quantity in cart") ||
    msg.includes("must contain at least one item") ||
    msg.includes("must contain at least one order")
  ) {
    return checkoutError("CART_CONFLICT");
  }

  // Pickup date rules (raised by the hardened RPCs).
  if (msg.includes("pickup date is required")) return checkoutError("PICKUP_DATE_REQUIRED");
  if (msg.includes("pickup date cannot be in the past")) return checkoutError("PICKUP_DATE_PAST");

  // Identity / profile guards.
  if (msg.includes("only business users can place orders") || msg.includes("not authenticated")) {
    return checkoutError("UNAUTHORIZED");
  }
  if (msg.includes("cannot place orders") && msg.includes("account is")) {
    return checkoutError("ACCOUNT_INACTIVE");
  }

  // V4 business-context guards
  if (msg.includes("not a member of the specified business")) {
    return checkoutError("UNAUTHORIZED");
  }
  if (msg.includes("does not have buying capability")) {
    return checkoutError("UNAUTHORIZED");
  }
  if (msg.includes("business is") && msg.includes("cannot place orders")) {
    return checkoutError("ACCOUNT_INACTIVE");
  }
  if (msg.includes("business not found")) {
    return checkoutError("UNAUTHORIZED");
  }

  // Catalogue / stock rules.
  if (msg.includes("is not available for ordering") || msg.includes("product not found")) {
    return checkoutError("PRODUCT_UNAVAILABLE");
  }
  if (msg.includes("insufficient stock")) return checkoutError("QUANTITY_UNAVAILABLE");
  if (msg.includes("minimum order")) return checkoutError("QUANTITY_UNAVAILABLE");
  if (msg.includes("does not belong to the specified farmer")) {
    return checkoutError("PRODUCT_UNAVAILABLE");
  }
  if (msg.includes("item quantity must be greater than zero")) {
    return checkoutError("QUANTITY_UNAVAILABLE");
  }
  if (msg.includes("invalid fulfillment type")) return genericCheckoutError();

  return genericCheckoutError();
}

/**
 * Maps the first failing issue of a `PlaceOrderSchema` parse.
 *
 * Only the *path* is inspected — never `issue.message`, because Zod's default
 * messages ("Invalid input: expected string, received undefined") are exactly the
 * implementation detail we must not leak. Unmapped paths collapse to GENERIC.
 */
export function mapCheckoutSchemaIssue(issue: { path?: PropertyKey[] } | undefined): CheckoutError {
  const path = issue?.path ?? [];
  const root = path[0];

  if (root === "pickupDate") {
    if (path.length > 1 && path[1] === "format") return checkoutError("PICKUP_DATE_INVALID");
    return checkoutError("PICKUP_DATE_REQUIRED");
  }
  if (root === "deliveryAddress") return checkoutError("DELIVERY_ADDRESS_REQUIRED");

  if (root === "items") {
    const leaf = path[path.length - 1];
    if (leaf === "quantity") return checkoutError("QUANTITY_UNAVAILABLE");
    if (leaf === "product_id") return checkoutError("PRODUCT_UNAVAILABLE");
    return checkoutError("EMPTY_CART");
  }

  if (root === "fulfillmentType") return genericCheckoutError();

  // farmerClerkId and anything unrecognised stay generic on purpose.
  return genericCheckoutError();
}