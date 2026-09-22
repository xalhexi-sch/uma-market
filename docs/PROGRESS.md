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
**Status:** ✅ **Complete & Fully Verified**

### Checkpoints:
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

## Slice 2 Final Verification (100% Real Live Database & Cryptographic Auth)

All tests below were executed and verified against the **live remote Supabase database** (`https://odnpkqjytrmciwmcehff.supabase.co`) using **cryptographically signed Clerk JWTs** for real test accounts (`buyer.test@example.com` and `farmer.test@example.com`):

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **Build** | `npm run build` | ✅ **PASS** | Exit code 0, 21 routes compiled cleanly via Turbopack |
| **Lint** | `npm run lint` | ✅ **PASS** | Exit code 0, zero ESLint warnings or errors |
| **Business Authenticated Browse Flow** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Authenticated buyer browses real products via RLS `products: read active` |
| **Product Detail** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Fetched product details with joined farmer metadata |
| **Add to Cart** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Inserted 12 units of produce into `cart_items` via RLS |
| **Cart Persistence** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Cart item correctly persisted and retrieved with quantity 12 |
| **Quantity Update** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Updated cart quantity from 12 → 15 |
| **Remove / Clear Cart** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Atomic checkout transaction clears cart items automatically upon order completion |
| **Checkout (Pickup Order)** | Buyer Clerk JWT → `place_order` RPC | ✅ **PASS** | Successfully placed Pickup Order (Order ID generated, DB transaction committed) |
| **Checkout (Seller Delivery Order)** | Buyer Clerk JWT → `place_order` RPC | ✅ **PASS** | Successfully placed Seller Delivery Order with delivery address & instructions |
| **Order Confirmation** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Verified order created with status `pending`, correct total, and snapshot items |
| **Order History** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Buyer successfully retrieves their purchase order history via RLS |
| **Farmer Product Creation** | Farmer Clerk JWT → Supabase Client | ✅ **PASS** | Farmer profile ownership enforced on produce creation |
| **Farmer Product Editing** | Farmer Clerk JWT → Supabase Client | ✅ **PASS** | Farmer updates active stock and status |
| **Farmer Incoming Order** | Farmer Clerk JWT → Supabase Client | ✅ **PASS** | Farmer reads orders placed by buyer via RLS `orders: farmer reads own` |
| **Farmer Status Transitions** | Farmer Clerk JWT → `update_order_status` | ✅ **PASS** | Progressed valid transitions: `pending` → `accepted` → `preparing` → `ready` → `for_delivery` → `completed` |
| **Business Sees Updated Status** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Buyer queries order and sees status updated to `completed` with `completed_at` timestamp |
| **Business A Cannot Access Business B's Cart/Orders** | Supabase RLS Policy | ✅ **PASS** | RLS blocks cross-tenant reads; queries return 0 rows for unowned carts/orders |
| **Farmer A Cannot Edit Farmer B's Products/Orders** | Supabase RLS Policy + RPC | ✅ **PASS** | Blocked with `'Not authorized to update this order'` and RLS zero-row update |
| **Unauthorized Role Invocation** | Buyer Calling Farmer RPC | ✅ **PASS** | Blocked with `"Only farmers can update order status"` |
| **Unauthorized Role Order Placement** | Farmer Calling Buyer RPC | ✅ **PASS** | Blocked with `"Only business users can place orders"` |
| **Invalid Order Quantities (< MOQ)** | Buyer Clerk JWT → `place_order` RPC | ✅ **PASS** | Ordering 5 units when MOQ is 10 rejected: `"Minimum order for ... is 10.00 kg"` |
| **Stock Bounding (> Stock Available)** | Buyer Clerk JWT → `place_order` RPC | ✅ **PASS** | Ordering 99,999 units rejected: `"Insufficient stock for ... — available: ..."` |
| **Inactive / Unavailable Products** | Buyer Clerk JWT → `place_order` RPC | ✅ **PASS** | Non-active products rejected with `"Product ... is not available for ordering"` |
| **Price Snapshot Integrity** | SQL Engine Inspection (`place_order`) | ✅ **PASS** | `order_items.unit_price` is read server-side from `products.price_per_unit` in PostgreSQL |
| **Stock Decrement Accuracy** | DB Query Check (`products`) | ✅ **PASS** | `quantity_available` decremented accurately by ordered quantity in atomic transaction |
| **Cart Clearing After Order** | DB Query Check (`cart_items`) | ✅ **PASS** | `cart_items` for buyer verified count = 0 immediately following `place_order` |
| **Invalid Status Transitions** | Farmer Clerk JWT → `update_order_status` | ✅ **PASS** | Attempting direct transition `pending` → `completed` rejected: `"Invalid transition: pending → completed"` |

---

## Slice 3 — Communications, Operations & Platform Polish
**Status:** ✅ **Complete & Verified**

### Checkpoints:
- [x] **Profile Operations:**
  - Implemented `getProfileByClerkId` in `src/lib/supabase/queries/profiles.ts`.
  - Implemented `updateProfile` Server Action in `src/app/(dashboard)/profile/actions.ts` with Clerk session auth and RLS ownership verification.
  - Implemented `ProfileForm` client component in `src/components/dashboard/profile-form.tsx` supporting contact person, business/farm name, phone, city, delivery address / pickup notes, and bio.
  - Built buyer profile page (`/business/profile`) and farmer profile page (`/farmer/profile`).
- [x] **Order-Threaded Direct Messaging:**
  - Implemented `getOrderMessages` and `getUserConversations` in `src/lib/supabase/queries/messages.ts` with resilient counterparty profile lookup.
  - Implemented `sendMessage` Server Action in `src/app/(dashboard)/messages/actions.ts` checking order participant authorization.
  - Implemented `OrderChat` component in `src/components/dashboard/order-chat.tsx` with optimistic UI append, auto-scroll, and sender/counterparty bubble distinction.
  - Embedded `OrderChat` directly into order detail views: `/business/orders/[id]` and `/farmer/orders/[id]`.
  - Implemented `ConversationsList` in `src/components/dashboard/conversations-list.tsx` and centralized inboxes: `/business/messages` and `/farmer/messages`.
- [x] **Admin Oversight & Moderation:**
  - Implemented `getAdminMetrics`, `getAdminProducts`, `getAdminOrders`, and `getAdminProfiles` in `src/lib/supabase/queries/admin.ts` using Supabase admin client.
  - Implemented `moderateProductStatus` Server Action in `src/app/(dashboard)/admin/actions.ts` for instant catalog moderation (archiving / restoring listings).
  - Built `/admin` dashboard overview with live KPI cards (Total Farmers, Active Buyers, Listed Produce, Wholesale Volume).
  - Built `/admin/products` catalog moderation with status filters and listing action buttons.
  - Built `/admin/orders` global wholesale audit log.
  - Built `/admin/farmers` producer directory.
  - Built `/admin/businesses` commercial buyer directory.
- [x] **Navigation & Quality Polish:**
  - Aligned navigation in `src/components/dashboard/sidebar.tsx` to remove non-existent placeholder routes and wire all implemented admin routes.
  - Verified `npm run lint` passes with 0 errors and 0 warnings.
  - Verified `npm run build` compiles 25 dynamic routes cleanly with Turbopack.

---

## Slice 3 Final Verification (100% Real Live Database & Cryptographic Auth)

Executed and verified against the **live remote Supabase database** (`https://odnpkqjytrmciwmcehff.supabase.co`) using **cryptographically signed Clerk JWTs** for multi-tenant accounts (`farmer1`, `buyer1`, `admin1`, `buyer2`, `farmer2`):

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **Build** | `npm run build` | ✅ **PASS** | Exit code 0, 25 routes compiled cleanly via Turbopack |
| **Lint** | `npm run lint` | ✅ **PASS** | Exit code 0, zero ESLint warnings or errors |
| **Farmer Profile Load** | Farmer Clerk JWT → Supabase Client | ✅ **PASS** | Farmer reads own profile via RLS `profiles: read own` |
| **Business Profile Load** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Business reads own profile via RLS `profiles: read own` |
| **Farmer Profile Persist** | Farmer Clerk JWT → Supabase Client | ✅ **PASS** | Bio & phone updated and persisted to remote database |
| **Business Profile Persist** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Bio & phone updated and persisted to remote database |
| **Refreshed Query Check** | Supabase Client Refetch | ✅ **PASS** | Refetched data matches updated values accurately |
| **Profile RLS Cross-User (Buyer2 → Buyer1)** | Buyer2 Clerk JWT → Supabase Client | ✅ **PASS** | Blocked by RLS (0 rows updated) |
| **Profile RLS Cross-User (Farmer2 → Farmer1)** | Farmer2 Clerk JWT → Supabase Client | ✅ **PASS** | Blocked by RLS (0 rows updated) |
| **Profile RLS Cross-Role (Buyer1 → Farmer1)** | Buyer1 Clerk JWT → Supabase Client | ✅ **PASS** | Blocked by RLS (0 rows updated) |
| **Order Chat: Business Send** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Message inserted into `messages` table for real order `2c33a782-...` |
| **Order Chat: Farmer Read** | Farmer Clerk JWT → Supabase Client | ✅ **PASS** | Farmer queries order messages and receives buyer's message via RLS |
| **Order Chat: Farmer Reply** | Farmer Clerk JWT → Supabase Client | ✅ **PASS** | Farmer reply inserted into `messages` table |
| **Order Chat: Business Read Reply** | Buyer Clerk JWT → Supabase Client | ✅ **PASS** | Buyer queries order messages and receives farmer's reply via RLS |
| **Messaging Privacy (Unrelated Buyer2)** | Buyer2 Clerk JWT → Supabase Client | ✅ **PASS** | Querying order conversation returned 0 rows via RLS |
| **Messaging Privacy (Unrelated Farmer2)** | Farmer2 Clerk JWT → Supabase Client | ✅ **PASS** | Querying order conversation returned 0 rows via RLS |
| **Messaging Injection Protection** | Buyer2 Clerk JWT → Supabase Client | ✅ **PASS** | Blocked from inserting message: `new row violates row-level security policy` |
| **Messaging Anti-Spoofing** | Buyer1 attempting `sender_clerk_id = farmer` | ✅ **PASS** | Blocked: `new row violates row-level security policy for table "messages"` |
| **Admin Live Metrics** | Admin Supabase Client | ✅ **PASS** | Verified live counts: 2 farmers, 2 buyers, 2 active listings, ₱1,625 GMV |
| **Admin Produce Catalog Query** | Admin Supabase Client | ✅ **PASS** | Joined query retrieves products with category and farmer provenance |
| **Admin Product Moderation (Archive/Restore)** | Admin Supabase Client | ✅ **PASS** | Archived product and restored back to active; DB state verified |
| **Admin Orders Audit Log** | Admin Supabase Client | ✅ **PASS** | Queried global wholesale orders table with participant joins |
| **Admin User Directories** | Admin Supabase Client | ✅ **PASS** | Queried farmers and businesses directories |
| **Admin Server Action Protection** | Non-Admin role check | ✅ **PASS** | Non-admin claims rejected from `moderateProductStatus` |
| **Navigation: All Dashboard Routes** | HTTP GET on localhost:3000 | ✅ **PASS** | 16 routes tested; 0 404 errors (all resolve cleanly) |

---

## Slice 4 — Production Readiness, Visual Commerce & Mobile Polish
**Status:** ⏳ **In Progress (Checkpoints 4.1 & 4.2 Verified)**

### Checkpoint 4.1: Visual Commerce & Supabase Storage (Verified ✅)
- **Database & Storage Migration (`20260923000001_slice4_storage.sql`):**
  - Added canonical `image_path TEXT` column to `public.products`.
  - Created public bucket `product-images` (max 5MB, JPEG/PNG/WebP).
  - Configured Storage RLS: public read, authenticated farmer upload/edit/delete isolated strictly to `products/{auth.jwt()->>'sub'}/*`.
  - Added `public.messages` to `supabase_realtime` publication.
- **Client & Upload Architecture:**
  - Used `useSupabase()` browser client with active Clerk session for direct storage uploads.
  - Added `validateProductImageFile` and `getProductImageUrl` in `src/lib/supabase/storage.ts`.
  - Updated `ProductForm` with drag/click upload, live thumbnail preview, and removal.
  - Server actions `createProduct` / `updateProduct` validate path ownership (`products/${userId}/...`) before saving.
  - Updated `ProductCard` and `/business/products/[id]` to render live produce photography.
- **Verification Results (Live Remote Supabase):**
  - Farmer uploaded image to own storage folder: ✅ **PASS**
  - Public CDN served image without auth (HTTP 200): ✅ **PASS**
  - Intruder farmer upload to other farmer folder rejected by Storage RLS: ✅ **PASS**
  - Buyer upload to farmer storage rejected by Storage RLS: ✅ **PASS**
  - Database `image_path` persisted and queried back: ✅ **PASS**
  - `npm run lint` & `npm run build`: ✅ **PASS** (0 errors, 0 warnings, 25 routes compiled)

### Checkpoint 4.2: Discovery, Sorting & Trust Verification (Verified ✅)
- **Query & Catalog Architecture:**
  - Extended `getActiveProducts` in `src/lib/supabase/queries/products.ts` with typed sort (`price_asc`, `price_desc`, `harvest_newest`, `name_asc`, `newest`) and `inStockOnly` conditional filtering.
  - Added sorting dropdown and "In Stock Only" / "All Availability" select controls in `/business/products` with query parameter preservation across category navigation.
- **Trust & Verification Workflow:**
  - Added `toggleProfileVerification(targetClerkId, isVerified)` server action in `src/app/(dashboard)/admin/actions.ts` with strict `user_role === 'admin'` authorization check.
  - Built interactive `AdminVerifyButton` client component in `src/components/dashboard/admin-verify-button.tsx` with live optimistic transitions.
  - Integrated verification toggle into `/admin/farmers` and `/admin/businesses` directory tables.
  - Displayed "Verified Local Producer" trust badge on `ProductCard` and product detail header.
- **Structured Order Cancellation Flow:**
  - Implemented cancellation reason modal in `src/components/dashboard/order-status-actions.tsx` prompting farmers for structured reasons (`Harvest shortfall / out of stock`, `Logistics constraint`, `Pricing discrepancy`, `Buyer requested cancellation`, `Other reason`).
  - Persisted cancellation reason and timestamp via `update_order_status` RPC to PostgreSQL `orders.cancellation_reason` and `orders.cancelled_at`.
- **Live Verification Results (Live Remote Supabase & Signed Clerk JWTs):**

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **Price Low → High Sorting** | Buyer Clerk JWT → PostgREST query | ✅ **PASS** | Ascending price sort verified (₱45 Saba Bananas, ₱65 Tomatoes) |
| **Price High → Low Sorting** | Buyer Clerk JWT → PostgREST query | ✅ **PASS** | Descending price sort verified (₱65 Tomatoes, ₱45 Saba Bananas) |
| **Newest Harvest Sorting** | Buyer Clerk JWT → PostgREST query | ✅ **PASS** | Harvest date ordered descending with nulls last |
| **Alphabetical Sorting** | Buyer Clerk JWT → PostgREST query | ✅ **PASS** | Alphabetical sorting ascending verified monotonically |
| **In-Stock Filtering** | Buyer Clerk JWT → PostgREST query | ✅ **PASS** | Excluded zero-stock items with `quantity_available > 0` |
| **Combination Filter Query** | Buyer Clerk JWT → PostgREST query | ✅ **PASS** | Category + Price Sort + In-Stock combination executed successfully |
| **Admin Farmer Verification** | Admin Client → `profiles` update | ✅ **PASS** | Admin verified farmer, buyer view reflected verified badge |
| **Admin Farmer Revocation** | Admin Client → `profiles` update | ✅ **PASS** | Admin revoked farmer verification, status set to `false` |
| **Admin Buyer Verification** | Admin Client → `profiles` update | ✅ **PASS** | Admin verified commercial buyer, status persisted |
| **Admin Buyer Revocation** | Admin Client → `profiles` update | ✅ **PASS** | Admin revoked buyer verification, status set to `false` |
| **Server Action Guard** | Non-admin session claims check | ✅ **PASS** | Buyer and Farmer rejected with `"Unauthorized. Admin role required."` |
| **Cross-Tenant RLS Guard** | Buyer Clerk JWT → Farmer profile | ✅ **PASS** | Cross-user profile modification blocked by RLS (0 rows affected) |
| **Cancellation Reason Persist** | Farmer Clerk JWT → `update_order_status` | ✅ **PASS** | Transitioned to `cancelled`, `cancellation_reason` & `cancelled_at` persisted |
| **Cancellation Terminal Guard** | Farmer Clerk JWT → `update_order_status` | ✅ **PASS** | Invalid transition from `cancelled` rejected: `"Order in terminal status cancelled cannot be updated"` |
| **Cross-Role Order RPC Guard** | Buyer Clerk JWT → `update_order_status` | ✅ **PASS** | Buyer rejected: `"Only farmers can update order status"` |
| **Code Quality & Build** | `npm run lint` & `npm run build` | ✅ **PASS** | 0 errors, 0 warnings, 25 dynamic routes compiled cleanly via Turbopack |

---

## Milestone Summary
- **Slice 1:** ✅ Complete & Verified
- **Slice 2:** ✅ Complete & Verified Across All Requirements
- **Slice 3:** ✅ Complete & Verified Across All Checkpoints & Security Matrix
- **Slice 4:** ⏳ In Progress (Checkpoints 4.1 & 4.2 Verified)