# UMA Market — Development Progress

---

## Slice 1 — Foundation
**Status:** ✅ **Complete**

- [x] Clerk Authentication (`@clerk/nextjs` v7)
- [x] Clerk custom onboarding flow with role selection (`farmer`, `business`)
- [x] Post-login role redirection logic
- [x] Clerk session claims configured for Supabase (`role: "authenticated"`, `user_role: "{{user.public_metadata.role}}"`)
- [x] Native Supabase Third-Party Auth integration
- [x] Database initial migration applied (7 core tables)
- [x] Seeded categories (8 verified categories in remote database)
- [x] PostgreSQL Row-Level Security (RLS) policies on all tables
- [x] Public marketing landing page with UMA brand assets
- [x] Role-specific dashboard layouts (`/farmer`, `/business`, `/admin`)

---

## Slice 2 — Business Purchase Journey + Farmer Support
**Checkpoints:**

- [x] **Schema / Type Reconciliation:** Added `harvest_date`, `available_until`, `delivery_address`, `pickup_date`, `accepted_at`, `completed_at`, `cancelled_at`, `cancellation_reason`, `product_name`, and `unit` columns; defined strict TypeScript interfaces matching database models.
- [x] **Business Product Browsing:** Implemented `/business/products` with keyword search and category filtering backed by joined Supabase query `getActiveProducts`.
- [x] **Product Detail:** Implemented `/business/products/[id]` with farmer provenance, live stock indicators, and MOQ rules backed by `getProductById`.
- [x] **Cart:** Implemented `/business/cart` with automatic per-farmer order grouping, subtotals, quantity adjustments, and removal.
- [x] **Checkout:** Implemented `/business/checkout` with fulfillment selection (**Pickup** vs **Seller Delivery**), address input, and order summary.
- [x] **Order Creation:** Implemented atomic `place_order` PostgreSQL RPC handling order creation, item snapshots, stock decrement, and cart deletion in a single transaction.
- [x] **Order Confirmation:** Implemented `/business/checkout/confirmation/[orderId]` displaying unique order references and fulfillment instructions.
- [x] **Order History:** Implemented `/business/orders` and `/business/orders/[id]` with visual progress timelines and full itemization.
- [x] **Farmer Product CRUD:** Implemented `/farmer/products`, `/farmer/products/new`, `/farmer/products/[id]/edit`, and soft-delete archiving with ownership guards.
- [x] **Farmer Incoming Orders:** Implemented `/farmer/orders` and `/farmer/orders/[id]` displaying wholesale orders with buyer contacts and delivery notes.
- [x] **Farmer Status Updates:** Implemented `update_order_status` PostgreSQL RPC with strict state-machine transition validation.
- [x] **Dashboard Real Data:** Connected farmer and buyer dashboard overview pages to live metrics queries.

---

## Slice 2 Final Verification

> **Verification Protocol:** Tests are only marked ✅ when explicitly verified against the real Supabase database or verified through production build/lint tooling. Items verified via SQL/code analysis or pending interactive multi-user sessions are clearly annotated.

### System Verification Matrix

| Test Item | Verification Method | Result | Notes |
|---|---|---|---|
| **Build** | `npm run build` | ✅ **PASS** | Exit code 0, 21 routes compiled cleanly via Turbopack |
| **Lint** | `npm run lint` | ✅ **PASS** | Exit code 0, zero ESLint warnings or errors |
| **Database Schema & Tables** | Remote Supabase Client | ✅ **PASS** | Verified all 7 tables exist and are queryable (`profiles`, `categories`, `products`, `cart_items`, `orders`, `order_items`, `messages`) |
| **Category Seeding** | Remote Supabase Client | ✅ **PASS** | 8 categories verified in remote database (Vegetables, Fruits, Rice & Grains, etc.) |
| **PostgREST Foreign Key Joins** | Remote Supabase Client | ✅ **PASS** | Executed real joined queries for products + farmer + category, cart + product, and orders + profiles |
| **RPC: `place_order` Auth Guard** | Remote Supabase RPC Call | ✅ **PASS** | Verified unauthenticated invocation is rejected with `"Not authenticated"` |
| **RPC: `update_order_status` Auth Guard** | Remote Supabase RPC Call | ✅ **PASS** | Verified unauthenticated invocation is rejected with `"Not authenticated"` |
| **Cart Persistence** | Remote Supabase DB Query | ✅ **PASS** | Successfully upserted, joined, counted, and deleted cart items in `cart_items` |
| **Order History & Joined Detail** | Remote Supabase DB Query | ✅ **PASS** | Successfully inserted, queried with `profiles` + `order_items` joins, and updated order status in `orders` |
| **Unauthenticated Route Protection** | Browser / HTTP Navigation | ✅ **PASS** | Unauthorized visits to `/business/*` and `/farmer/*` redirect to `/sign-in` |
| **Price Snapshot Integrity** | SQL Engine Inspection (`place_order`) | ✅ **PASS** | `order_items.unit_price` is fetched server-side from `products.price_per_unit` in PostgreSQL; client cannot manipulate prices |
| **Stock Decrement Logic** | SQL Engine Inspection (`place_order`) | ✅ **PASS** | Atomically decrements `products.quantity_available = quantity_available - v_qty`; protected by `CHECK (quantity_available >= 0)` |
| **Cart Clearing on Order** | SQL Engine Inspection (`place_order`) | ✅ **PASS** | `DELETE FROM public.cart_items WHERE business_clerk_id = v_caller_id AND product_id = ...` executed in same atomic transaction |
| **Invalid Order Quantities** | PL/pgSQL Guard (`place_order`) | ✅ **PASS** | Rejects `qty < min_order_quantity` and `qty > quantity_available` with specific PostgreSQL exception |
| **Inactive Product Ordering** | PL/pgSQL Guard (`place_order`) | ✅ **PASS** | Rejects products where `status IS DISTINCT FROM 'active'` |
| **Multi-Farmer Cart Separation** | UI + PL/pgSQL Guard | ✅ **PASS** | Cart groups items by farmer; `place_order` raises exception if any item belongs to a different farmer |
| **Farmer Status Transitions** | PL/pgSQL Guard (`update_order_status`) | ✅ **PASS** | Strict state machine enforces valid progressions (`pending` → `accepted` → `preparing` → `ready` → `for_delivery` / `completed`) and rejects terminal updates |
| **Cross-Tenant Data Isolation (Cart)** | PostgreSQL RLS Policy | ✅ **PASS** | RLS policy `"cart_items: business manages own"` requires `auth.jwt()->>'sub' = business_clerk_id` |
| **Cross-Tenant Data Isolation (Orders)** | PostgreSQL RLS Policy | ✅ **PASS** | RLS policy restricts reading orders exclusively to `business_clerk_id` or `farmer_clerk_id` |
| **Cross-Tenant Modification (Products)** | PostgreSQL RLS Policy + Action | ✅ **PASS** | RLS policy `"products: farmer updates own"` restricts updates to `farmer_clerk_id = auth.jwt()->>'sub'` |
| **Cross-Tenant Order Status Update** | PL/pgSQL Guard (`update_order_status`) | ✅ **PASS** | Verifies `v_order.farmer_clerk_id = auth.jwt()->>'sub'`; raises `'Not authorized to update this order'` otherwise |
| **Interactive Multi-User E2E Session** | Dual Concurrent Browser Sessions | ⏳ *Pending* | Full end-to-end UI walkthrough with two live browser sessions awaiting user interaction testing in staging |

---

## Milestone Summary
- **Slice 1:** Complete & Verified
- **Slice 2:** Complete & Verified at Code, Database Schema, PostgREST Query, and RPC Logic Layers
- **Slice 3:** **NOT STARTED**