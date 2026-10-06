import { z } from "zod";

// ── Product ──────────────────────────────────────────
// ── V4 Listings & Inventory ──────────────────────────
// Mirrors the SQL rules in create/update_business_listing and
// adjust_business_inventory; the database re-validates every field.
const MAX_STOCK_QUANTITY = 99_999_999.99;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function hasAtMostTwoDecimals(value: number): boolean {
  return Number.isFinite(value) && Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

const listingQuantity = (label: string) =>
  z
    .number({ error: `Enter a ${label}.` })
    .max(MAX_STOCK_QUANTITY, `That ${label} is too large.`)
    .refine(hasAtMostTwoDecimals, `Enter a ${label} with up to 2 decimal places.`);

export const ListingInputSchema = z
  .object({
    name: z
      .string({ error: "Listing name is required." })
      .trim()
      .min(1, "Listing name is required.")
      .max(200, "Listing name must be 200 characters or fewer."),
    category_id: z.string().uuid("Choose a valid category.").nullable(),
    description: z
      .string()
      .trim()
      .max(5000, "Description must be 5000 characters or fewer."),
    price_per_unit: listingQuantity("price").refine((v) => v > 0, "Price must be greater than 0."),
    unit: z.string({ error: "Choose a unit." }).min(1, "Choose a unit.").max(50, "Choose a valid unit."),
    min_order_quantity: listingQuantity("minimum order").refine(
      (v) => v > 0,
      "Minimum order must be greater than 0."
    ),
    quantity_available: listingQuantity("stock quantity").refine(
      (v) => v >= 0,
      "Opening stock cannot be negative."
    ),
    harvest_date: z.string().regex(ISO_DATE, "Enter a valid harvest date.").nullable(),
    available_until: z.string().regex(ISO_DATE, "Enter a valid available-until date.").nullable(),
    status: z.enum(["active", "draft"], { error: "Choose to publish or save as a draft." }),
    image_paths: z
      .array(z.string().min(1, "Invalid photo.").max(300, "Invalid photo."))
      .max(5, "A listing can have up to 5 photos."),
  })
  .refine(
    (v) => !v.harvest_date || !v.available_until || v.available_until >= v.harvest_date,
    { message: "Available-until date cannot be before the harvest date.", path: ["available_until"] }
  );

export type ListingInput = z.infer<typeof ListingInputSchema>;

export const ListingStatusSchema = z.object({
  productId: z.string().uuid("Invalid listing."),
  status: z.enum(["active", "draft", "archived"], { error: "Choose a valid listing status." }),
});

const stockQuantity = z
  .number({ error: "Enter a quantity." })
  .min(0, "Quantity cannot be negative.")
  .max(MAX_STOCK_QUANTITY, "That quantity is too large.")
  .refine(hasAtMostTwoDecimals, "Enter a quantity with up to 2 decimal places.");

const stockReason = z.string().trim().max(500, "Note must be 500 characters or fewer.").optional();

export const InventoryAdjustmentSchema = z.discriminatedUnion(
  "type",
  [
    z.object({
      type: z.literal("RECEIVED"),
      productId: z.string().uuid("Invalid listing."),
      quantity: stockQuantity.refine((v) => v > 0, "Quantity must be greater than 0."),
      reason: stockReason,
    }),
    z.object({
      type: z.literal("SPOILAGE"),
      productId: z.string().uuid("Invalid listing."),
      quantity: stockQuantity.refine((v) => v > 0, "Quantity must be greater than 0."),
      reason: stockReason,
    }),
    z.object({
      type: z.literal("ADJUSTMENT"),
      productId: z.string().uuid("Invalid listing."),
      // The counted stock, applied only if the balance still equals expectedQuantity.
      quantity: stockQuantity,
      expectedQuantity: stockQuantity,
      reason: stockReason,
    }),
  ],
  { error: "Choose a valid stock action." }
);

export type InventoryAdjustmentInput = z.infer<typeof InventoryAdjustmentSchema>;

// ── Cart ─────────────────────────────────────────────
export const AddToCartSchema = z.object({
  productId: z.string().uuid("Invalid product ID."),
  quantity: z.number().int().positive("Quantity must be greater than zero."),
});

export const UpdateCartItemSchema = z.object({
  cartItemId: z.string().uuid("Invalid cart item ID."),
  quantity: z.number().int().positive("Quantity must be greater than zero."),
});

// ── Checkout ─────────────────────────────────────────
export const PlaceOrderSchema = z.object({
  farmerClerkId: z.string().min(1, "Farmer ID is required."),
  fulfillmentType: z.enum(["pickup", "seller_delivery"]),
  deliveryAddress: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  pickupDate: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid("Invalid product ID."),
        quantity: z.number().int().positive("Quantity must be greater than zero."),
      })
    )
    .min(1, "At least one item is required."),
});

export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;

// ── Order Status ─────────────────────────────────────
export const UpdateOrderStatusSchema = z.object({
  orderId: z.string().uuid("Invalid order ID."),
  newStatus: z.enum([
    "pending",
    "accepted",
    "preparing",
    "ready",
    "for_delivery",
    "completed",
    "cancelled",
  ]),
  cancellationReason: z.string().trim().max(500).optional(),
});

// ── Cancel Order ─────────────────────────────────────
export const CancelOrderSchema = z.object({
  orderId: z.string().uuid("Invalid order ID."),
});

// ── Verified Reviews ─────────────────────────────────
const ReviewFields = {
  rating: z.number().int().min(1, "Rating must be at least 1.").max(5, "Rating cannot exceed 5."),
  comment: z.string().trim().max(1000, "Review must be 1000 characters or fewer.").optional(),
};

export const CreateSellerReviewSchema = z.object({
  orderId: z.string().uuid("Invalid order ID."),
  ...ReviewFields,
});

export const CreateProductReviewSchema = z.object({
  orderId: z.string().uuid("Invalid order ID."),
  orderItemId: z.string().uuid("Invalid order item ID."),
  ...ReviewFields,
});

export type CreateSellerReviewInput = z.infer<typeof CreateSellerReviewSchema>;
export type CreateProductReviewInput = z.infer<typeof CreateProductReviewSchema>;

// ── Profile ──────────────────────────────────────────
export const UpdateProfileSchema = z.object({
  full_name: z.string().trim().max(200).optional(),
  business_name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  city: z.string().trim().max(200).optional(),
  bio: z.string().trim().max(2000).optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// ── Message ──────────────────────────────────────────
export const SendMessageSchema = z.object({
  orderId: z.string().uuid("Invalid order ID."),
  body: z.string().trim().min(1, "Message cannot be empty.").max(2000),
});

export const SendV4MessageSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID."),
  body: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message cannot exceed 2000 characters."),
  productId: z.string().uuid("Invalid product ID.").optional().nullable(),
  orderId: z.string().uuid("Invalid order ID.").optional().nullable(),
});

// ── Admin ────────────────────────────────────────────
export const ModerateProductSchema = z.object({
  productId: z.string().uuid("Invalid product ID."),
  newStatus: z.enum(["active", "draft", "archived"]),
});

export const ToggleVerificationSchema = z.object({
  targetClerkId: z.string().min(1, "Target user ID is required."),
  isVerified: z.boolean(),
});

export const UpdateAccountStatusSchema = z.object({
  targetClerkId: z.string().min(1, "Target user ID is required."),
  status: z.enum(["active", "suspended", "revoked"]),
});
