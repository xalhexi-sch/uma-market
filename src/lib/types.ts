import type {
  UserRole,
  OrderStatus,
  FulfillmentType,
  ProductStatus,
} from "./constants";

// ── Profile ────────────────────────────────────────
export interface Profile {
  id: string;
  clerk_id: string;
  role: UserRole;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  address: string | null;
  city: string;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// ── Category ───────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

// ── Product ────────────────────────────────────────
export interface Product {
  id: string;
  farmer_clerk_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_per_unit: number;
  unit: string;
  quantity_available: number;
  min_order_quantity: number;
  image_url: string | null;
  harvest_date: string | null;
  available_until: string | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  // Joined
  farmer?: Pick<Profile, "clerk_id" | "full_name" | "business_name" | "city" | "avatar_url" | "bio" | "phone">;
  category?: Pick<Category, "id" | "name" | "slug">;
}

// ── Order ──────────────────────────────────────────
export interface Order {
  id: string;
  business_clerk_id: string;
  farmer_clerk_id: string;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  total_amount: number | null;
  notes: string | null;
  delivery_address: string | null;
  pickup_date: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  // Joined
  business?: Pick<Profile, "clerk_id" | "full_name" | "business_name" | "city" | "phone" | "address">;
  farmer?: Pick<Profile, "clerk_id" | "full_name" | "business_name" | "city" | "phone">;
  items?: OrderItem[];
}

// ── Order Item ─────────────────────────────────────
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string | null;   // snapshot at order time
  quantity: number;
  unit: string | null;           // snapshot at order time
  unit_price: number;            // snapshot at order time
  subtotal: number;              // generated: quantity * unit_price
  created_at: string;
  // Joined
  product?: Product;
}

// ── Cart Item ──────────────────────────────────────
export interface CartItem {
  id: string;
  business_clerk_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  // Joined
  product?: Product;
}

// ── Message ────────────────────────────────────────
export interface Message {
  id: string;
  order_id: string;
  sender_clerk_id: string;
  body: string;
  created_at: string;
  // Joined
  sender?: Pick<Profile, "clerk_id" | "full_name" | "avatar_url">;
}
