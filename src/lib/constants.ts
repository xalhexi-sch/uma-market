// ── Roles ──────────────────────────────────────────
export const ROLES = {
  FARMER: "farmer",
  BUSINESS: "business",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// ── Order Statuses ─────────────────────────────────
export const ORDER_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  PREPARING: "preparing",
  READY: "ready",
  FOR_DELIVERY: "for_delivery",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  for_delivery: "For Delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

// ── Fulfillment Types ──────────────────────────────
export const FULFILLMENT_TYPE = {
  PICKUP: "pickup",
  SELLER_DELIVERY: "seller_delivery",
} as const;

export type FulfillmentType =
  (typeof FULFILLMENT_TYPE)[keyof typeof FULFILLMENT_TYPE];

export const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  pickup: "Pickup",
  seller_delivery: "Seller Delivery",
};

// ── Product Statuses ───────────────────────────────
export const PRODUCT_STATUS = {
  ACTIVE: "active",
  DRAFT: "draft",
  OUT_OF_STOCK: "out_of_stock",
  ARCHIVED: "archived",
} as const;

export type ProductStatus =
  (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: "Active",
  draft: "Draft",
  out_of_stock: "Out of Stock",
  archived: "Archived",
};

// ── Product Units ──────────────────────────────────
export const PRODUCT_UNITS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "bundle", label: "Bundle" },
  { value: "piece", label: "Piece" },
  { value: "sack", label: "Sack" },
  { value: "crate", label: "Crate" },
  { value: "tray", label: "Tray" },
] as const;

// ── Categories ─────────────────────────────────────
export const CATEGORIES = [
  { slug: "vegetables", name: "Vegetables", icon: "ri-plant-line" },
  { slug: "fruits", name: "Fruits", icon: "ri-apple-line" },
  { slug: "rice-grains", name: "Rice & Grains", icon: "ri-seedling-line" },
  { slug: "root-crops", name: "Root Crops", icon: "ri-leaf-line" },
  { slug: "herbs-spices", name: "Herbs & Spices", icon: "ri-plant-line" },
  { slug: "poultry-eggs", name: "Poultry & Eggs", icon: "ri-checkbox-blank-circle-line" },
  { slug: "fish-seafood", name: "Fish & Seafood", icon: "ri-fish-line" },
  { slug: "other", name: "Other", icon: "ri-archive-line" },
] as const;

// ── Currency ───────────────────────────────────────
export const CURRENCY = "₱";

// ── App Info ───────────────────────────────────────
export const APP_NAME = "UMA Market";
export const APP_TAGLINE = "From Farm to Business.";
export const APP_DESCRIPTION =
  "A localized agricultural procurement marketplace connecting Butuan's farmers directly with local businesses.";
