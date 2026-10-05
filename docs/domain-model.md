# UMA V4 — Domain Model

## 1. Human/account model

```text
User
  │
  ├── Business A ── Owner/Staff
  ├── Business B ── Owner/Staff
  └── Business C ── Owner/Staff
```

A user signs in once and may operate multiple businesses.

## 2. Business model

A business is the ownership boundary for:

- listings;
- inventory;
- business orders;
- business messages;
- business settings.

Market capability:

```text
can_buy
can_sell
```

This is intentionally simple.

## 3. Membership model

```text
business_members
- business_id
- user_id
- role (OWNER | STAFF)
- created_at
```

Uniqueness should prevent duplicate memberships.

The first user who creates a business receives `OWNER`.

## 4. Catalog

For V4, the current `products` table continues to represent a producer's listing.

Conceptually:

```text
Product/listing
  ↓
owned by Business
  ↓
has Inventory
```

Do not add a canonical commodity table unless the product later needs cross-seller comparison/benchmarking.

## 5. Inventory

Current quantity remains available for efficient product queries.

Add:

```text
inventory_movements
- id
- product_id
- business_id
- movement_type
- quantity_delta
- reason
- reference_type
- reference_id
- created_by
- created_at
```

Movement types can include:

```text
RECEIVED
RESERVED
RELEASED
SOLD
SPOILAGE
ADJUSTMENT
```

Actual values should follow the final schema migration contract.

## 6. Orders

```text
buyer_business
      ↓
    order
      ↓
   order_items
      ↓
 seller_business
```

Order items should preserve the price/product snapshot needed for historical integrity.

## 7. Order state

```text
PENDING
  ├── ACCEPTED
  ├── REJECTED
  └── CANCELLED

ACCEPTED → PREPARING → READY → FULFILLED
```

Only valid transitions are allowed.

## 8. Fulfillment

Pickup and delivery are different fulfillment paths.

### Pickup

```text
Confirmed → Preparing → Ready for pickup → Picked up
```

### Delivery

```text
Confirmed → Preparing → Ready → Out for delivery → Delivered
```

Do not show delivery-only states to pickup orders.

## 9. Messaging

```text
business A
     ↕
conversation
     ↕
business B
```

The conversation does not belong to one order.

Messages can optionally reference:

```text
product_id
order_id
```

Recommended future structure:

```text
conversations
- business_a_id
- business_b_id

messages
- conversation_id
- sender_user_id
- body
- created_at
- read_at

message_contexts
- message_id
- product_id nullable
- order_id nullable
```

Use a canonical ordering or equivalent uniqueness rule so the same business pair does not get duplicate conversations.

## 10. Notifications

Notifications should be based on business events such as:

```text
ORDER_CREATED
ORDER_ACCEPTED
ORDER_REJECTED
ORDER_READY
ORDER_FULFILLED
MESSAGE_RECEIVED
PRODUCT_BACK_IN_STOCK
LOW_STOCK
```

Avoid storing UI route strings as the core identity of a notification whenever a stable resource reference can be stored instead.

## 11. Favorites

```text
favorites
- user_id or business_id
- product_id
- created_at
```

The final owner key depends on whether favorites are considered personal or business-level; default to business-level only if the product experience treats saved products as shared business data.

## 12. Cart & Checkout Ownership

### Decision: Business owns the cart

In UMA V4, a cart belongs to a **Business**, not an individual user.

```text
User (Clerk identity)
  ↓
Active Business (with can_buy capability)
  ↓
Cart (business_id) ── shared by Owner & Staff
  ↓
Checkout / Order (buyer_business_id → seller_business_id)
```

### Rationale

1. **B2B Commercial Boundary**: Orders in V4 are contracts between a `buyer_business` and a `seller_business` (`buyer_business → order → seller_business`). The cart represents the pre-order staging state for that commercial transaction.
2. **Multi-Business Isolation**: When an individual user operates or works for multiple businesses (e.g., Farm A and Restaurant B), each business maintains its own isolated cart. Switching active business switches the active cart context without data loss or cross-contamination.
3. **Staff Collaboration**: Staff members assist with operational purchasing. A business-owned cart allows authorized staff and owners to view and prepare orders for the business without sharing personal credentials.
4. **Capability Gating**: Cart access and checkout require the active business to possess the `can_buy` capability.

### Interaction Rules

- **Switching Carts**: Carts are scoped by `business_id`. Switching active business in the UI switcher switches the visible cart context to that business's cart. Cart items of inactive businesses remain untouched in the database.
- **Role Permissions (Owner & Staff)**:
  - Both `OWNER` and `STAFF` of a business with `can_buy = true` can view the business cart, add items, update quantities, and remove items.
  - Both `OWNER` and `STAFF` can proceed to checkout and place orders on behalf of the business.
  - Users without membership in the business or belonging to businesses without `can_buy` cannot access or mutate the cart.
- **Cart Lifecycle on Active Business Switch**:
  - No items are deleted, moved, or merged when switching active businesses.
  - Active business context dictates which `business_id` is queried and rendered.
- **Minimum Schema Evolution**:
  - Add additive `business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE` to `public.cart_items`.
  - Add index `idx_cart_items_business_id` on `cart_items(business_id)`.
  - Add unique constraint/index `UNIQUE (business_id, product_id)`.
  - RLS checks membership via `business_members(business_id, user_id)` and business capability (`can_buy`).
  - Retain legacy `business_clerk_id TEXT` nullable during migration for backward compatibility with existing V2 actions/RPCs until fully migrated.

## 13. Future domains

These can be added later without changing the current UX model:

- verification requests/evidence;
- quotes/RFQ;
- recurring orders;
- bulk/tier pricing;
- producer/buyer analytics;
- stronger trust signals.

