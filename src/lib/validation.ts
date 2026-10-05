import { z } from "zod";

// ── Product ──────────────────────────────────────────
export const ProductFormSchema = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(200),
  category_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(5000).optional(),
  price_per_unit: z.number().positive("Price must be greater than 0."),
  unit: z.string().min(1).max(50),
  quantity_available: z.number().int().min(0, "Quantity cannot be negative."),
  min_order_quantity: z.number().int().positive("Minimum order must be greater than 0."),
  harvest_date: z.string().nullable().optional(),
  available_until: z.string().nullable().optional(),
  status: z.enum(["active", "draft"]),
  image_path: z.string().nullable().optional(),
  images: z
    .array(
      z.object({
        id: z.string().optional(),
        image_path: z.string(),
        sort_order: z.number().int(),
      })
    )
    .max(5)
    .optional(),
});

export type ProductFormInput = z.infer<typeof ProductFormSchema>;

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
