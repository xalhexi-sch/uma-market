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

### Checkpoint 4.3: Realtime Coordination & Operational Alerts (Verified ✅)
- **Supabase Realtime Architecture:**
  - Verified remote publication `supabase_realtime` includes `public.messages`.
  - Added Clerk session JWT synchronization with Supabase Realtime WebSocket client in `src/hooks/use-supabase.ts`.
  - Upgraded `src/components/dashboard/order-chat.tsx` with `supabase.channel('order-messages:${orderId}')` listening to `postgres_changes` INSERT events.
  - Implemented deduplication and optimistic message replacement logic with automatic scroll and cleanup on unmount.
- **Operational Sidebar Badges:**
  - Added `getFarmerPendingOrderCount` in `src/lib/supabase/queries/orders.ts` for farmer pending orders awaiting review.
  - Added `getBusinessActiveOrderCount` in `src/lib/supabase/queries/orders.ts` for buyer active orders in `ready` or `for_delivery`.
  - Updated `src/app/(dashboard)/layout.tsx` to fetch scoped operational counts per authenticated role.
  - Updated `src/components/dashboard/sidebar.tsx` with color-coded badges (`amber-600` for Farmer pending orders, `emerald-600` for Business ready/delivery orders, `primary` for Cart) that automatically suppress when count = 0.
- **Live Verification Results (Live Remote Supabase & Multi-User Signed Clerk JWTs):**

| Test Item                              | Verification Method                                    | Result     | Verification Details                                                       |
| ----------------------------------------| --------------------------------------------------------| ------------| ----------------------------------------------------------------------------|
| **Realtime Channel Connect**           | Authenticated Clerk JWT → Supabase Realtime            | ✅ **PASS** | Subscribed status confirmed for Farmer and Buyer channels                  |
| **Business → Farmer Realtime Message** | Buyer Insert → Farmer Realtime Listener                | ✅ **PASS** | Farmer received new message in real time without page refresh              |
| **Farmer → Business Realtime Reply**   | Farmer Insert → Buyer Realtime Listener                | ✅ **PASS** | Buyer received farmer reply in real time without page refresh              |
| **Participant Privacy via Realtime**   | Intruder Realtime Listener on shared order             | ✅ **PASS** | Unrelated user received 0 events (RLS enforced at Realtime layer)          |
| **Anti-Tamper Message Injection**      | Intruder Clerk JWT → `messages` insert                 | ✅ **PASS** | Blocked: `"new row violates row-level security policy for table messages"` |
| **Realtime Channel Cleanup**           | `removeChannel` on unmount/teardown                    | ✅ **PASS** | All channels cleanly removed; zero subscription leaks                      |
| **Farmer Pending Orders Badge**        | Server Component Query → `getFarmerPendingOrderCount`  | ✅ **PASS** | Pending orders accurately counted and displayed on "Orders" nav            |
| **Farmer Badge Update on Transition**  | `update_order_status` RPC (pending → accepted)         | ✅ **PASS** | Badge count decremented accurately from 1 → 0 upon status transition       |
| **Business Active Orders Badge**       | Server Component Query → `getBusinessActiveOrderCount` | ✅ **PASS** | Orders in `ready` or `for_delivery` counted and displayed                  |
| **Business Badge Completion Update**   | Order status transition to `completed`                 | ✅ **PASS** | Badge count decremented from 1 → 0; disappeared cleanly                    |
| **Cross-Tenant Count Isolation**       | Intruder query on Buyer1's orders                      | ✅ **PASS** | RLS returned count = 0; cross-user order counting blocked                  |
| **Code Quality & Build**               | `npm run lint` & `npm run build`                       | ✅ **PASS** | 0 errors, 0 warnings, 25 dynamic routes compiled cleanly via Turbopack     |

### Checkpoint 4.4: Mobile Navigation & Production Hardening (Verified ✅)
- **Mobile Navigation Drawer (`src/components/dashboard/mobile-nav.tsx`):**
  - Implemented responsive mobile topbar (`md:hidden`) with hamburger toggle button (`RiMenuLine`), UMA Market branding, role badge, cart shortcut with dynamic count badge, and Clerk `UserButton`.
  - Implemented slide-over `Sheet` drawer (`side="left"`) with role-based navigation links, operational counter badges, active route highlighting, and automatic close on route selection (`setOpen(false)`).
  - Preserved existing desktop sidebar (`hidden md:flex`) and wrapped dashboard layout in `flex-col md:flex-row min-w-0` to eliminate horizontal overflow.
- **Next.js Dashboard Error Boundary (`src/app/(dashboard)/error.tsx`):**
  - Created client error boundary with UMA branding, retry action calling `reset()`, and secure development/production error boundary handling.
- **Responsive UI Audit & Spacing Fixes:**
  - Replaced `overflow-hidden` with `overflow-x-auto` on data table containers across orders and products pages.
  - Added responsive padding (`p-4 sm:p-6 lg:p-8`) on messages and profile pages, eliminating viewport edge collision.
  - Updated checkout fulfillment cards and produce pricing fields to responsive stacking (`grid-cols-1 sm:grid-cols-2`).
  - Standardized image resolution on `CartItemRow` with `getProductImageUrl`.
  - Polished public landing page hero composition and typography for mobile viewports (375px/390px).
- **UI Primitive Audit:**
  - Audited all components: verified 0 unsupported `Button asChild` instances. Links behaving as buttons use `buttonVariants()`.
- **Live Verification Results:**

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **Route Integrity Audit** | Physical filesystem check | ✅ **PASS** | All 23 dashboard page source files exist and compile cleanly |
| **Mobile Drawer Architecture** | Static code analysis | ✅ **PASS** | Uses Sheet primitive (`side="left"`), `setOpen(false)` on click, `aria-label` accessibility |
| **Dashboard Error Boundary** | Component contract check | ✅ **PASS** | Client component implementing `error` and `reset` handlers with UMA branding |
| **Table Horizontal Responsiveness** | Static code analysis | ✅ **PASS** | All data tables on orders and products pages wrapped with `overflow-x-auto` |
| **Page Padding Consistency** | Static code analysis | ✅ **PASS** | Unified `p-4 sm:p-6 lg:p-8` on messages and profile pages |
| **Form Mobile Stacking** | Static code analysis | ✅ **PASS** | `grid-cols-1 sm:grid-cols-2` on checkout fulfillment and produce supply fields |
| **Button asChild Compliance** | Repository audit | ✅ **PASS** | 0 instances of unsupported `Button asChild` in codebase |
| **Buyer Query via RLS** | Buyer Clerk JWT → Supabase | ✅ **PASS** | Authenticated buyer queries active produce via RLS |
| **Farmer Query via RLS** | Farmer Clerk JWT → Supabase | ✅ **PASS** | Authenticated farmer queries incoming orders via RLS |
| **Admin Audit Query via RLS** | Admin Clerk JWT → Supabase | ✅ **PASS** | Admin executes platform governance audit query via RLS |
| **Cross-Tenant RLS Security** | Buyer Clerk JWT → Farmer produce | ✅ **PASS** | Unauthorized update strictly blocked (0 rows updated) |
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings |
| **Production Build** | `npm run build` | ✅ **PASS** | 29 dynamic routes compiled cleanly via Turbopack |

---

## Slice 5 — Pilot Readiness & Operational Integrity
**Status:** ✅ **Complete & Verified**

### Checkpoint 5.1: Structural Integrity & User Feedback (Verified ✅)
- Wired `Toaster` with Base UI in root `layout.tsx` and created typed helper methods (`toast.success`, `toast.error`, `toast.info`, `toast.warning`).
- Wired toast notifications across profile saves, produce listing CRUD, cart adds, order cancellations, and admin moderation.
- Implemented branded custom 404 pages: global (`src/app/not-found.tsx`) and dashboard (`src/app/(dashboard)/not-found.tsx`).
- Created skeleton loading states (`loading.tsx`) across all 10 primary dashboard routes.
- Built buyer pending-order cancellation with confirmation dialog (`CancelOrderButton`) and `cancelOrder` server action enforcing RLS policy `"orders: business cancels pending"`.

### Checkpoint 5.2: Profile Resilience & Clerk Webhook (Verified ✅)
- Implemented `POST /api/webhooks/clerk` with cryptographic signature verification via `verifyWebhook(req)` from `@clerk/nextjs/webhooks`.
- Handled lifecycle events:
  - `user.created`: Upserts stub profile if valid role metadata exists.
  - `user.updated`: Logged safely without overwriting UMA-owned profile fields; fallback stub creation if profile row was dropped.
  - `user.deleted`: Automatically archives farmer products (`status = 'archived'`) while preserving historical profile and order records.
- Added profile recovery banner to `(dashboard)/layout.tsx` prompting users to complete setup if profile record is missing.
- Documented `CLERK_WEBHOOK_SIGNING_SECRET` in `.env.example`.

### Checkpoint 5.3: Demo Data & Marketplace Content (Verified ✅)
- Built idempotent seeding script `scripts/seed-demo-data.ts` executable via `npm run seed:demo`.
- Seeded 4 fictional demo farmers and 2 fictional commercial buyers with realistic Agusan Valley/Butuan agricultural profiles.
- Seeded 21 wholesale products across all 8 catalog categories with market-accurate ₱ pricing, stock quantities, and MOQs.
- Uploaded high-resolution produce photography buffers directly to Supabase Storage `product-images` bucket serving via public CDN URLs.
- Seeded 4 wholesale orders with item snapshots across pending, preparing, completed, and cancelled states.

### Checkpoint 5.4: Admin Completeness & Operational Polish (Verified ✅)
- Built `/admin/orders/[id]` detail inspection page with counterparty contact dossiers, fulfillment logistics, item breakdown, and read-only message audit log.
- Linked order reference numbers in `/admin/orders` to detail audit views.
- Extended farmer dashboard with Total Revenue (`₱`) and Fulfillment Rate (`%`) KPI cards.
- Polished empty states across farmer orders, produce listings, and conversations with actionable CTA buttons.

### Slice 5 Verification Results

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **Base UI Toast Provider** | Root layout inspection & TypeScript | ✅ **PASS** | Wrapped in `<Toaster>`, typed helper methods functional |
| **Buyer Order Cancellation** | Server action & Base UI AlertDialog | ✅ **PASS** | Cancels pending order, updates DB state, triggers toast |
| **Global 404 Routing** | HTTP GET `/random-missing-page-test` | ✅ **PASS** | Returns HTTP 404 with UMA Market branded layout |
| **Dashboard 404 Routing** | HTTP GET `/dashboard/invalid-route` | ✅ **PASS** | Returns HTTP 404 with back-to-dashboard CTA |
| **Route Skeleton Loading** | 10x `loading.tsx` verification | ✅ **PASS** | All routes supply skeleton UI during suspense |
| **Clerk Webhook Security** | HTTP POST `/api/webhooks/clerk` unsigned | ✅ **PASS** | Rejected with HTTP 400 `Webhook verification failed` |
| **Proxy Non-Blocking Gate** | Next.js dev server request trace | ✅ **PASS** | Public webhook endpoint reached without redirect loop |
| **Demo Data Seed Idempotency** | Double execution of `npm run seed:demo` | ✅ **PASS** | Clean execution with 0 errors on repeated runs |
| **Produce Storage Upload** | Supabase Storage `product-images` CDN | ✅ **PASS** | 21 images uploaded and served via CDN public URLs |
| **Admin Order Inspection** | Next.js App Router dynamic route | ✅ **PASS** | `/admin/orders/[id]` compiles and inspects orders & messages |
| **Farmer Revenue & Fulfillment** | `getFarmerOrderMetrics` query | ✅ **PASS** | Real-time aggregate calculation of completed revenue & rate |
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings across all files |
| **Turbopack Build** | `npm run build` | ✅ **PASS** | 30 dynamic routes compiled cleanly |

---

## Slice 6 — Production Deployment
**Status:** ⏳ **In Progress (Checkpoint 6.1 Complete)**

### Checkpoint 6.1: Production Code Hardening (Verified ✅)
- **Hardcoded URL Removal:**
  - Removed fallback `|| "https://odnpkqjytrmciwmcehff.supabase.co"` from `src/lib/supabase/storage.ts`.
  - `process.env.NEXT_PUBLIC_SUPABASE_URL!` is now the sole source of truth — prevents silent misconfiguration in production.
- **Health Check Endpoint:**
  - Created `src/app/api/health/route.ts` returning `{ status: "ok", version: "0.1.0", timestamp }`.
  - Used for deployment verification and monitoring. Does not probe external dependencies.
- **robots.txt:**
  - Created `public/robots.txt` allowing crawling of public landing page.
  - Disallows `/farmer/`, `/business/`, `/admin/`, `/onboarding/`, `/sign-in/`, `/sign-up/`, `/api/`.
- **Production Metadata:**
  - Added `metadataBase` to root `layout.tsx` using `process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"`.
  - Enhanced OpenGraph with `siteName: "UMA Market"`, `locale: "en_PH"`.
  - Added `robots: { index: true, follow: true }` meta configuration.
  - Added keywords: `"wholesale"`, `"B2B"`.
- **Environment Documentation:**
  - Updated `.env.example` with production vs. development key guidance.
  - Documented `NEXT_PUBLIC_APP_URL` for canonical URL resolution.
  - Added security notes for Vercel Secret type variables.
  - Documented that production and development use different webhook signing secrets.

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings across all files |
| **Production Build** | `npm run build` | ✅ **PASS** | 32 routes compiled cleanly via Turbopack |
| **Health Endpoint** | Route compilation check | ✅ **PASS** | `/api/health` compiled as dynamic server route |
| **robots.txt** | Static file check | ✅ **PASS** | Served from `public/robots.txt` |
| **Hardcoded URL** | Code inspection | ✅ **PASS** | No fallback URLs remain in codebase |
| **metadataBase** | Build compilation | ✅ **PASS** | Resolves from `NEXT_PUBLIC_APP_URL` env var |

### Checkpoint 6.2–6.5: Production Deployment (Manually Verified ✅)
- Vercel production deployment + custom domain
- Clerk Production instance + Google OAuth
- Clerk → Supabase Third-Party Auth integration
- Farmer onboarding, Business onboarding, and Admin dashboard
- Product creation and wholesale orders
- Supabase Storage direct uploads (exp claim timestamp check resolved)
- Message persistence & webhook delivery
- Bot sign-up protection

### Production QA Polish (Verified ✅)
- **1. Realtime Chat Live Delivery Fix:**
  - Migrated `src/lib/supabase/client.ts` from `@supabase/ssr` (`createBrowserClient`) to direct `@supabase/supabase-js` `createClient` with dynamic `accessToken` callback and `auth: { persistSession: false, autoRefreshToken: false }`, eliminating singleton caching and cookie-auth conflicts with Clerk Third-Party Auth.
  - In `src/components/dashboard/order-chat.tsx`, asynchronously retrieved fresh Clerk JWT via `getToken()` and primed `supabase.realtime.setAuth(token)` before calling `channel.subscribe()`.
  - Ensured Phoenix WebSocket join payload carries `access_token` so Supabase Realtime authorizes the `postgres_changes` RLS policy without requiring recipient refresh.
  - Reconciled optimistic messages immediately on send success, providing instantaneous local update while deduplicating incoming broadcast messages.
- **2. Onboarding Loading Feedback:**
  - Extracted onboarding form to `src/app/onboarding/onboarding-form.tsx` client component.
  - Added immediate visible loading feedback on the "Continue" submit button (disabled state, animated `Spinner`, and "Setting up your account…" text).
  - Disabled `<fieldset>` during submission to prevent role tampering and duplicate form dispatches.
  - Preserved existing `completeOnboarding` server action, Clerk `publicMetadata.role` update, Supabase profile upsert, and redirect flow through `/onboarding/complete` session refresh to `/farmer` or `/business`.
- **3. Authenticated Root Routing Fix:**
  - Removed automatic role dashboard redirect from `src/app/page.tsx`, allowing `/` to remain accessible as the public marketplace landing page for both authenticated and unauthenticated visitors.
  - Implemented dynamic navigation CTAs on `/`: authenticated users see "Dashboard" and Clerk `UserButton` in the navbar, and "Go to Dashboard" in the hero and final CTA sections; unauthenticated visitors continue to see "Sign in" and "Get started".
  - Updated `DashboardSidebar` and `DashboardMobileNav` to include a clickable brand header leading to `/` and an explicit "Marketplace Home" navigation link, enabling bidirectional navigation between `/` and `/farmer`, `/business`, and `/admin`.
  - Preserved role-based authorization guards across all dashboard layouts and sub-pages.
- **4. Landing Page Final Visual Direction (Full-Bleed Photographic Hero):**
  - Integrated the farmer + sunrise agricultural photograph (`public/hero-farmer-sunrise.jpg`) as a full-bleed, full-width photographic hero across the entire viewport.
  - Implemented an intentional directional readability scrim (`from-black/85 via-black/55 to-transparent`), providing strong contrast for white typography on the left while leaving the farmer, crops, and sunrise completely unobstructed and visually dominant on the right.
  - Preserved the exact headline `"Fresh from Butuan's farms to your business."` and concise supporting copy.
  - Streamlined CTAs strictly to two: `"Explore products"` and `"Sell on UMA"` (with `"Go to Dashboard"` for authenticated sessions).
  - Compacted the value strip into a subtle, non-card 4-pillar bar (`Origin`, `Trade`, `Access`, `Supply`).
  - Formatted "How UMA Works" into an open, airy, 3-step typographic process (`Discover`, `Order`, `Fulfill`) free of heavy cards.
  - Formatted "For Farmers / For Businesses" into a clean two-column layout with subtle vertical divider and green dot bullets rather than card boxes.
  - Maintained full public accessibility of `/` for both authenticated and unauthenticated visitors.
- **5. Business Dashboard Agricultural Banner:**
  - Refined the Business Buyer dashboard welcome banner in `src/app/(dashboard)/business/page.tsx` titled `"Fresh produce from local farmers"` with supporting copy `"Source available produce and manage your wholesale orders in one place."`
  - Re-architected as a polished marketplace welcome card using design tokens (`bg-card`, `border-border`, `text-foreground`, `text-primary`), natural mobile stacking (visual accent header on mobile, right-aligned pane on desktop with seamless directional gradient blend), `Direct Farm Sourcing` indicator cue, and a subtle forest green `"Browse products →"` CTA linking to `/business/products` with hover microinteraction.
  - Aligned suspense loading skeleton in `src/app/(dashboard)/business/loading.tsx`.

### Public Marketplace Experience (`/products` & `/products/[id]`) (Complete & Verified ✅)
- **1. Public Marketplace Catalog (`/products`):**
  - Fully accessible without login, built with the finalized UMA white-first, forest green editorial design system.
  - Minimal public navigation header featuring `Products` (active), `How it works`, `For Farmers`, and `For Businesses`. Zero messages links exposed in public navigation.
  - Prominent search input supporting produce names, crop varieties, and local farm names with instant clear and apply.
  - Horizontal category pill bar ("All Produce" + 8 agricultural categories).
  - Sort selector ("Newest Added", "Freshest Harvest", "Price: Low to High", "Price: High to Low", "Name: A to Z") and In-stock availability filter ("In Stock Only" vs "All Availability").
  - **Real Data Discovery Sections:** "Available Now" (in-stock produce ready for order), "Fresh Picks & Recent Harvests" (recent harvest dates), "Browse by Category" (interactive category cards with descriptions), and "All Produce Listings" (complete active catalog). No fake reviews, sales numbers, or artificial scarcity.
  - Filtered search view with item counts, active query indicators, and clean filter reset.
- **2. Public Product Detail View (`/products/[id]`):**
  - Breadcrumb navigation (`Home / Products / [Category] / [Product Name]`).
  - Large produce photo container with fallback agricultural iconography.
  - Scannable B2B procurement data: product name, category badge, transparent farm-gate pricing (`₱XX.XX per unit` — never hidden), available quantity, and minimum order quantity (MOQ).
  - Harvest date and available-until date when available.
  - Producer Provenance Card: Farm / producer name, city location, verified local producer badge, and producer bio.
  - Wholesale fulfillment options card explaining Farm Pickup and Seller Delivery.
  - **Role-Aware Procurement & Ordering:**
    - **Visitors (unauthenticated):** Informational commercial procurement box with prominent "Sign in to Order" and "Create Business Account" CTAs (with redirect URL preservation).
    - **Commercial Business Buyers:** Interactive `AddToCartControls` client component with quantity counter, MOQ enforcement, real-time subtotal calculation, and "Add to Cart" server action with toast confirmation.
    - **Farmers:** Informational notice that wholesale purchasing is reserved for commercial businesses, with direct shortcut to the Farmer Dashboard (`/farmer/products`).
    - **Administrators:** Direct shortcut to moderate produce in the Admin Catalog (`/admin/products`).
- **3. Landing Page Integration:** Added "Products" (`/products`) to top navigation and footer; updated Hero and Final CTAs "Explore products" to route directly to `/products`.
- **4. Security & Authorization:** Strict `status = 'active'` isolation across all public queries; draft products remain private; zero secret keys exposed in client bundles/browser; resilient server-side farmer provenance enrichment via server admin client.

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings across all files |
| **Production Build** | `npm run build` | ✅ **PASS** | 34 routes compiled cleanly via Turbopack, including `/products` and `/products/[id]` |
| **Public Marketplace Browsing** | Browser subagent (desktop) | ✅ **PASS** | Visitors browse `/products` without login; search, category pills, and discovery sections render |
| **Category & Search Filtering** | Browser subagent | ✅ **PASS** | Filtering by "Vegetables" and searching for "Tomato" returns matching active listings with counts |
| **Product Detail & Provenance** | Browser subagent | ✅ **PASS** | `/products/[id]` displays image, farm-gate price, MOQ, harvest date, producer provenance card, and fulfillment badges |
| **Role-Aware Ordering (Visitor)** | Browser subagent | ✅ **PASS** | Unauthenticated visitors see "Sign in to Order" and "Create Business Account" CTAs with redirect query param |
| **Role-Aware Ordering (Business)** | Code inspection + Server Action | ✅ **PASS** | Commercial buyers can configure quantities and invoke `addToCart` Server Action |
| **Role-Aware Restriction (Farmer)** | Code inspection + Server Action | ✅ **PASS** | Farmers see informational note; `addToCart` server action strictly rejects non-business users |
| **Draft Product Protection** | Node script against remote Supabase | ✅ **PASS** | Public query for draft products returns 0; only active listings appear |
| **Mobile Responsiveness (375px)** | Browser subagent (mobile viewport) | ✅ **PASS** | Verified responsive card layout, scrollable pills, and slide-over mobile drawer navigation |

---

### Brand, Navbar & CTA Polish (Complete & Verified ✅)
- **1. Transparent-Over-Hero Public Navbar:**
  - `LandingNavbar` client component with scroll listener (`window.scrollY > 20`).
  - Transparent at top of hero with crisp white brand text and subtle drop shadow over agricultural hero photograph.
  - Added subtle top gradient scrim (`from-black/80 via-black/35 to-transparent`) behind navbar to guarantee high contrast.
  - Smooth 300ms transition to solid light background (`bg-background/95 backdrop-blur-md border-b border-border/60 shadow-xs`) with dark-on-light text on scroll.
  - Spans full width (`w-full inset-x-0`) across desktop and mobile viewports with centered content grid (`max-w-6xl mx-auto`).
- **2. Navigation Hierarchy:**
  - Structure: Left: UMA Market brand mark + text; Center: `Market` (`/products`), `How it works` (`/#how`), `For growers` (`/#growers`); Right: `I'm a grower` (`/#growers`), `Explore the market` (`/products`), `Sign in` / `Dashboard` + Clerk `UserButton`.
  - Zero messages links or dashboard-specific admin controls exposed in public navbar.
- **3. CTA & Branding Hierarchy:**
  - Marketplace-first framing: Local Farm Produce → Available on UMA → For Local Business Buyers.
  - Primary CTA: "Explore the market →" (`/products`) with highest visual prominence.
  - Secondary CTA: "I'm a grower →" (`/#growers`) cleanly visible but visually subordinate.
  - Authenticated landing page `/` remains accessible; authenticated CTA pair: "Explore the market →" + "Dashboard →".
  - Section 4 Grower Framing: "For Growers" / "Sell your produce directly to local businesses."
  - Section 5 Final CTA: "Explore the market →" + "I'm a grower →" / "Go to Dashboard →".
- **4. Favicon & Brand Asset Finalization:**
  - Generated multi-resolution `favicon.ico` containing 16x16, 32x32, and 48x48 icons from official brand asset `uma-icon-512.png`.
  - Finalized `icon.png` (512x512) for high-DPI displays and home screens.
  - Configured Next.js App Router metadata with `{ icon: [...], apple: [...] }`.
  - Works crisp against browser light and dark UI themes without full wordmark or tiny typography.
- **5. Mobile Navigation Polish:**
  - Responsive slide-over drawer with official UMA brand mark, clean navigation hierarchy, single integrated close trigger, and prominent "Explore the market" and auth actions.

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings across all files |
| **Production Build** | `npm run build` | ✅ **PASS** | 34 routes compiled cleanly via Turbopack |
| **Transparent Navbar** | Browser subagent | ✅ **PASS** | Transparent at top of hero; logo and nav text crisp and readable over photo |
| **Solid Scrolled Navbar** | Browser subagent | ✅ **PASS** | Smooth transition to full-width solid light navbar with dark text on scroll |
| **Brand Logo Visibility** | Browser subagent | ✅ **PASS** | Official brand mark and typography remains visible and crisp in both transparent and solid states |
| **Explore the Market CTA** | Browser subagent | ✅ **PASS** | Clicking hero and navbar CTA navigates directly to `/products` |
| **I'm a Grower CTA** | Browser subagent | ✅ **PASS** | Smoothly scrolls to `#growers` section with grower-specific selling copy |
| **Favicon Resolution** | PIL inspection + metadata | ✅ **PASS** | Multi-size ICO (16, 32, 48) and PNG (512) loaded cleanly |
| **Mobile Drawer (375px)** | Browser subagent | ✅ **PASS** | Clean slide-over drawer with aligned nav links, prominent CTAs, and zero duplicate close buttons |

---

### Public Experience UX/UI Refinement (Complete & Verified ✅)
- **1. Seed Script Product Image Audit & Correction:**
  - Audited demo product URLs in `scripts/seed-demo-data.ts`.
  - Replaced wrong/duplicate Unsplash URLs:
    - **Fresh Yellow Ginger (Luya):** Replaced duplicate eggplant photo (`photo-1615485290382-441e4d049cb5`) with verified ginger harvest root photo (`https://images.unsplash.com/photo-1635008388183-04ea0313c5d1?w=800&auto=format&fit=crop&q=80`).
    - **Yellow Sweet Camote:** Replaced cabbage photo (`photo-1598030343246-eec71cb44231`) with verified sweet potato pile photo (`https://images.unsplash.com/photo-1753445657069-ba23263dd733?w=800&auto=format&fit=crop&q=80`).
    - **Native Purple Ube:** Replaced 404 URL (`photo-1596097635092-6d3c8e3e4f1e`) with verified purple yam/tuber photo (`https://images.unsplash.com/photo-1730815048561-45df6f7f331d?w=800&auto=format&fit=crop&q=80`).
  - Added support for `SUPABASE_SERVICE_ROLE_KEY` fallback alongside `SUPABASE_SECRET_KEY` in `scripts/seed-demo-data.ts`.
  - Executed `npm run seed:demo` live against remote Supabase: verified photos were downloaded and stored in Supabase Storage `product-images` bucket (`products/.../*.jpg`), and live database records were updated with new image URLs and timestamps.
- **2. Global CSS Utilities:**
  - Added `@utility no-scrollbar` and cross-browser `.no-scrollbar` classes (WebKit `display: none`, Firefox/IE `scrollbar-width: none`) in `src/app/globals.css` for horizontal scrolling components.
- **3. Product Rail Components:**
  - `ProductRailCarousel` (`src/components/marketplace/product-rail-carousel.tsx`): Client-side carousel wrapper using shadcn Carousel primitive and `embla-carousel-react` (`slidesToScroll: 1`, responsive basis: `basis-[85%] sm:basis-[48%] lg:basis-[25%]`, conditional desktop prev/next controls when items > 4).
  - `FreshOnUmaRail` (`src/components/marketplace/fresh-on-uma-rail.tsx`): Server component fetching 6 in-stock products via `getActiveProducts({ inStockOnly: true, sort: "newest", limit: 6 })`, rendered with clear eyebrow ("Fresh on UMA"), headline ("What's available now"), and "Explore more produce →" link to `/products`.
- **4. Landing Page Refactor (`src/app/page.tsx`):**
  - Integrated `<FreshOnUmaRail />` wrapped in `<Suspense>` with skeleton fallback directly after the full-bleed photographic hero.
  - Removed redundant proof/value strip to accelerate user time-to-produce discovery.
  - Streamlined "How UMA Works" to 3 scannable steps (01 Discover, 02 Order, 03 Fulfill) without redundant copy.
  - Tightened Growers and Businesses sections to 3 concise benefit lines each with consistent primary action CTAs ("I'm a grower →" and "Explore the market →").
- **5. Navbar Deduplication:**
  - Removed duplicate "I'm a grower" text link from right-side CTAs in `landing-navbar.tsx` and `marketplace-header.tsx`, preserving single source of truth in center navigation list (`For growers` → `/#growers`).
- **6. Marketplace Page Polish (`src/app/products/page.tsx`):**
  - Removed redundant "Fresh Picks & Recent Harvests" section to eliminate repetitive produce grid cards.
  - Cleaned up overly formal eyebrow labels in favor of a clean, scannable "In Stock" indicator.
  - Increased "Available Now" discovery grid from 4 to 6 items (`limit: 6`, 2 balanced rows on `lg:grid-cols-3`).
- **7. Product Detail Verification (`src/app/products/[id]/page.tsx`):**
  - Verified complete preservation of wholesale procurement data, producer provenance card, MOQ enforcement, and role-aware order actions. Zero regressions.

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings across all files |
| **Production Build** | `npm run build` | ✅ **PASS** | 35 routes compiled cleanly via Turbopack |
| **Fresh on UMA Product Rail** | Server Component + Embla | ✅ **PASS** | Fetches 6 active in-stock listings; client wrapper renders responsive carousel with desktop arrows and mobile swipe |
| **Product Images Audit** | Unsplash validation | ✅ **PASS** | Verified correct harvest photography for ginger, camote, and ube |
| **Navbar Deduplication** | Code inspection | ✅ **PASS** | Removed duplicate "I'm a grower" from right CTAs; center nav remains single entry point |
| **Marketplace Discovery** | Code inspection | ✅ **PASS** | Available Now increased to 6 items; Fresh Picks duplicate section removed; clean scannable eyebrows |
| **Product Detail Integrity** | Code inspection | ✅ **PASS** | `/products/[id]` verified with zero regressions |

---

### SaaS Showcase Physical Hardware Refinement & Code Simplification (Complete & Verified ✅)
- **1. Physical Device Mockup Presentation Assets (`public/showcase/`):**
  - Reduced device composition to exactly 2 desktop laptops and 1 realistic smartphone:
    - `desktop-marketplace.webp` (170 KB, 2000x1260): Realistic physical laptop chassis in Space Gray anodized aluminum with camera notch, rounded corners, inner bezel, and front deck thumb notch. Screen displays real UMA `/products` marketplace with search, Butuan location pill, categories, and 3 produce cards.
    - `desktop-grower.webp` (111 KB, 2000x1260): Matching physical laptop chassis angled in the opposite orientation for visual balance. Screen displays real `/farmer/products` inventory table, 3 KPI metric cards, verified farm badge, and order progression notice with direct buyer chat.
    - `phone-marketplace.webp` (66 KB, 800x1200): Realistic dark titanium smartphone with Dynamic Island, status bar (`9:41`), side buttons, and responsive mobile marketplace UI.
- **2. Showcase Architecture Simplification:**
  - Removed redundant 4th order fulfillment/messaging browser block; integrated fulfillment progression and chat coordination into copy and the grower operational tools.
  - Removed 8 obsolete browser-frame assets (`marketplace-showcase.*`, `grower-showcase.*`, `order-fulfillment-showcase.*`, `mobile-showcase.*`) from `public/showcase/`.
  - Maintained single clean showcase architecture: 3 physical hardware WebP assets, Next.js `<Image />` tags, and lightweight `<ScrollReveal>` container animations with `prefers-reduced-motion` compliance.
- **3. Refined Landing Page Narrative:**
  - Hero (Farmer + sunrise) → Fresh on UMA (real produce carousel) → Software Showcase ("Real tools for the real work") → Desktop #1 (Marketplace) → Desktop #2 (Grower tools) → Phone (UMA on every screen) → How UMA Works (Discover → Order → Fulfill) → Final CTA.

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings across all files |
| **Production Build** | `npm run build` | ✅ **PASS** | 35 routes compiled cleanly via Turbopack |
| **Approved Hero** | Code inspection | ✅ **PASS** | Photographic hero and CTAs completely preserved |
| **Fresh on UMA Rail** | Server component + Embla | ✅ **PASS** | Horizontal carousel displaying 6 in-stock products |
| **Desktop #1 Marketplace Laptop** | Image render + layout | ✅ **PASS** | Realistic Space Gray laptop chassis with real produce discovery UI |
| **Desktop #2 Grower Laptop** | Image render + layout | ✅ **PASS** | Matching laptop chassis with real inventory table and order status |
| **Smartphone Device** | Image render + layout | ✅ **PASS** | Realistic dark titanium phone with responsive mobile marketplace layout |
| **Device Count Reduction** | Page architecture audit | ✅ **PASS** | Reduced to exactly 2 laptops and 1 smartphone; eliminated separate 4th mockup |
| **Code Cleanup & Single Implementation** | Directory audit + grep | ✅ **PASS** | Only 1 clean showcase implementation; all dead assets removed |
| **Scroll Reveal Animations** | IntersectionObserver + CSS | ✅ **PASS** | Smooth 700ms cubic bezier entrance; instant render on `prefers-reduced-motion` |
| **Mobile Responsiveness** | CSS viewport checks | ✅ **PASS** | No horizontal overflow; all frames and copy stack cleanly on mobile |

---

### Final Public Landing Refinement: Visual Composition, Oversized Hardware, Buyer Trust & Dark Mode (Complete & Verified ✅)
- **1. Realistic Hardware Mockup Assets (`public/showcase/`):**
  - Refined showcase toward premium modern product-campaign presentation:
    - `desktop-marketplace.webp` (166 KB, 2000x1260): Realistic aluminum laptop chassis with front deck, thumb notch, camera, realistic glass reflections, and live `/products` produce discovery UI.
    - `desktop-grower.webp` (99 KB, 1960x1160): Realistic aluminum slate tablet displaying grower inventory management, pricing controls, KPI cards, and live order progression.
    - `phone-marketplace.webp` (66 KB, 800x1200): Realistic dark titanium smartphone with Dynamic Island, status bar, and responsive mobile marketplace UI.
- **2. Oversized Asymmetric Campaign Layout:**
  - Marketplace Laptop: Oversized presentation bleeding intentionally past the right margin (`lg:w-[124%] lg:-mr-16 xl:-mr-24 lg:translate-x-4`).
  - Grower Slate Tablet: Oversized presentation bleeding intentionally past the left margin (`lg:w-[124%] lg:-ml-16 xl:-ml-24 lg:-translate-x-4`).
  - Mobile Smartphone: Realistic phone layout with generous whitespace and 2 field-ready capability cards.
  - Zero horizontal overflow (`scrollWidth <= clientWidth`) enforced via `overflow-hidden` section containment.
- **3. Narrative & Copy Cleanup:**
  - Removed hero eyebrow `"Butuan City · Agricultural Marketplace"` — hero goes directly into `"Fresh from Butuan's farms to your business."`
  - Added restrained buyer trust strip: `"Built for businesses sourcing local produce"` with safe category pills (`Restaurants`, `Canteens`, `Grocers`, `Hotels`, `Caterers`) — zero fabricated partner logos.
  - Removed explanatory bridge `"The Software Behind the Market"` — page transitions directly from Fresh on UMA into the real product showcases.
- **4. Complete Light / Dark Mode System:**
  - Integrated `next-themes` with `ThemeProvider` and OKLCH color token compatibility.
  - `ThemeToggle` component in public navbar with dynamic contrast: light/transparent over hero before scroll, solid/light/dark after scroll.
  - Global `"D"` keyboard shortcut for instant theme toggling with strict input/textarea/contenteditable safety and repeat/modifier guards.
- **5. About UMA Page (`/about`):**
  - Dedicated public route with concrete agricultural positioning: the problem in Butuan, structured trade tools, who UMA serves, and local Caraga corridor focus.
  - Added "About" link to public navbar and footer.

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings across all files |
| **Production Build** | `npm run build` | ✅ **PASS** | 36 routes compiled cleanly via Turbopack |
| **Hero Copy Cleanup** | Code & visual inspection | ✅ **PASS** | Eyebrow removed; direct headline; approved sunrise imagery preserved |
| **Buyer Trust Strip** | Code & visual inspection | ✅ **PASS** | Safe positioning with 5 commercial buyer types; no fake brand claims |
| **Marketplace Laptop Mockup** | Edge Headless 1440px | ✅ **PASS** | Oversized bleeding off right edge; crisp produce UI |
| **Grower Tablet Mockup** | Edge Headless 1440px | ✅ **PASS** | Oversized bleeding off left edge; authentic farm operations UI |
| **Smartphone Mockup** | Edge Headless 1440px | ✅ **PASS** | Realistic titanium phone with responsive mobile layout |
| **Dark Mode System** | ThemeProvider + next-themes | ✅ **PASS** | System default, manual toggle, seamless dark/light contrast |
| **"D" Keyboard Shortcut** | CDP & simulated key events | ✅ **PASS** | Toggles theme instantly; safely ignored in text fields and modifiers |
| **About UMA Route** | Edge Headless `/about` | ✅ **PASS** | Dedicated `/about` page renders with active route highlight and footer |
| **Mobile Responsiveness** | Edge Headless 390px | ✅ **PASS** | No horizontal overflow; responsive drawer with theme toggle and all links |

---

### Visual Correction: Device Mockups & Hardware Presentation (Complete & Verified ✅)
- **1. Landscape Tablets (iPad Pro Form Factor):**
  - Replaced the thin laptop chassis visual with two premium landscape tablet / display form factors (iPad Pro visual language).
  - Thick physical brushed aluminum body, visible precision-milled metallic edge and bezel thickness, speaker holes, chamfered rim, and realistic rounded corners.
  - Subtle 3D perspective and rotation:
    - Marketplace tablet (`desktop-marketplace.webp`, 1600x1426): Angled slightly inward to the right (`rotate={1.2}` reveal settling).
    - Grower tablet (`desktop-grower.webp`, 1600x1426): Angled symmetrically inward to the left (`rotate={-1.2}` reveal settling).
  - 100% authentic UMA UI content preserved inside each screen with zero green fringing and seamless inner bezel blending.
- **2. Thick 3D Smartphone (Titanium Flagship Form Factor):**
  - Replaced flat phone with tactile 3D titanium smartphone render (`phone-marketplace.webp`, 800x1810).
  - Visible body thickness, physical tactile side buttons, antenna bands, rounded metallic frame, Dynamic Island, and generous status bar breathing room.
  - Screen displays authentic mobile marketplace layout.
- **3. Unclipped Soft Diffused Shadows & Overflow Handling:**
  - Provided generous canvas padding so multi-layered contact and ambient shadows diffuse naturally to 0 opacity without harsh boundary cuts.
  - Replaced restrictive `overflow-hidden` on sections with `overflow-x-clip` on root wrapper and `<main>` container, eliminating horizontal scroll while allowing vertical device shadows to breathe completely.
- **4. Unified Physical Reveal Animation:**
  - Updated `ScrollReveal` (`src/components/marketplace/showcase/scroll-reveal.tsx`) to support `rotate?: number`.
  - Animates the physical device container as ONE single object (`opacity`, `translateY`, `scale`, and settling `rotate` into `rotate(0deg)`).
  - Preserved strict `motion-reduce:transition-none motion-reduce:!transform-none motion-reduce:!opacity-100` accessibility compliance.

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings across all files |
| **Production Build** | `npm run build` | ✅ **PASS** | 36 routes compiled cleanly via Turbopack |
| **Marketplace Tablet Mockup** | Visual & image audit | ✅ **PASS** | Premium landscape iPad Pro form factor; authentic produce catalog; no laptop base |
| **Grower Tablet Mockup** | Visual & image audit | ✅ **PASS** | Matching landscape iPad Pro; authentic inventory & metrics UI; visible metallic edge |
| **3D Smartphone Mockup** | Visual & image audit | ✅ **PASS** | Thick titanium flagship; tactile buttons; Dynamic Island; status bar padding |
| **Shadow Clipping Prevention** | Code & layout inspection | ✅ **PASS** | Zero shadow cutoff; diffuse ambient fade; `overflow-x-clip` container containment |
| **Page Structure & Scope Integrity** | Git diff audit | ✅ **PASS** | Zero modifications to hero, copy, data, nav, auth, or backend logic |

---

### Product Media Gallery (`feat/product-media-gallery`) (Complete & Verified ✅)
- **1. Database Schema & RLS Policies (`20260924000001_product_media_gallery.sql`):**
  - Created `public.product_images` table (`id`, `product_id`, `image_path`, `sort_order`, `created_at`, `UNIQUE(product_id, image_path)`).
  - Configured RLS policies:
    - `SELECT`: Public can view active product images; farmers can view their own; admins view all.
    - `INSERT`, `UPDATE`, `DELETE`: Farmers can only mutate images for products they own (`auth.jwt()->>'sub' = farmer_clerk_id`).
    - `ALL`: Admin role access.
  - Safe backfill: Migrated all existing `products.image_path` entries into `product_images` (`sort_order = 0`), ensuring zero regression for existing listings.
- **2. Reusable ProductGallery Component (`src/components/marketplace/product-gallery.tsx`):**
  - Built with existing shadcn/ui `Carousel` (`embla-carousel-react`).
  - Desktop: Large main display, slide counter pill (`1 / 3`), Previous/Next arrow buttons, and clickable thumbnail strip with active green focus ring (`ring-2 ring-primary`).
  - Mobile: Smooth touch-swipeable carousel, responsive height, and thumbnail indicators with zero horizontal overflow.
  - Single-image products: Clean hero display with all redundant carousel buttons and thumbnails hidden.
  - Zero-image products: Branded fallback placeholder rendered cleanly.
  - Keyboard navigation: Left/right arrow keys navigate slides via embla.
- **3. Farmer Multi-Photo Management (`src/components/dashboard/product-form.tsx` & `actions.ts`):**
  - Upgraded farmer create/edit form to support up to 5 produce photos (JPEG, PNG, WebP up to 5MB).
  - Primary / Cover photo clearly badged, always synchronized with `products.image_path` for backwards compatibility with cards, cart, and search.
  - Secondary photos grid with "Set as Primary" and "Remove" actions.
  - Safe storage deletion: When removing a photo, underlying storage objects are cleaned up only if not referenced by other products or gallery records.
- **4. Verified Live Integration:**
  - Integrated `<ProductGallery>` into public `/products/[id]` and buyer `/business/products/[id]`.

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings across all files |
| **Production Build** | `npm run build` | ✅ **PASS** | 35 routes compiled cleanly via Turbopack |
| **Multi-Image Carousel** | Browser subagent (1440px) | ✅ **PASS** | Slide counter (`1 / 3`), next/prev controls, and thumbnail click jump to slide |
| **Single-Image Product** | Browser subagent (1440px) | ✅ **PASS** | Single clean image; redundant carousel controls and thumbnails hidden |
| **No-Image Fallback** | Browser subagent (1440px) | ✅ **PASS** | Branded SVG placeholder rendered cleanly with no layout distortion |
| **Mobile Responsiveness** | Browser subagent (390px) | ✅ **PASS** | Touch-swipeable carousel; zero horizontal overflow (`scrollWidth === clientWidth`) |
| **Database Migration & Backfill** | `npx supabase db push` | ✅ **PASS** | `20260924000001_product_media_gallery.sql` applied; existing products backfilled |

---

### Launch Readiness P1 Fixes (`fix/launch-readiness`) (Complete & Verified ✅)
- **1. Stock Restitution on Order Cancellation (`20260924000002_launch_readiness_p1.sql`):**
  - Created `trigger_restore_stock_on_order_cancelled()` with `trg_restore_stock_on_cancelled` trigger on `public.orders`.
  - Fires strictly on status transitions `WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')`.
  - Automatically queries `public.order_items` for the cancelled order and increments `products.quantity_available += quantity`.
  - SECURITY DEFINER guarantees atomic, permission-safe execution across both buyer cancellations (`cancelOrder`) and farmer rejections (`update_order_status`).
  - Guards against double-restoration on subsequent updates to already-cancelled orders.
- **2. Public Farmer Data Privacy (`queries/products.ts` & `types.ts`):**
  - Removed `phone` from public queries in `getActiveProducts` (primary and fallback) and `getProductById` (primary and fallback).
  - Updated `Product.farmer` TypeScript definition in `src/lib/types.ts` to exclude `phone`.
  - Preserved public provenance fields: `clerk_id`, `full_name`, `business_name`, `city`, `avatar_url`, `bio`, and `is_verified`.
  - Prevents leaking farmers' personal phone numbers into public HTML/RSC payloads for anonymous visitors while retaining private phone access in authenticated buyer order details.
- **3. Business Product Navigation Consistency (`business/products` & `business`):**
  - Updated `ProductCard` calls in `src/app/(dashboard)/business/products/page.tsx` and `src/app/(dashboard)/business/page.tsx` to pass `href={`/business/products/${product.id}`}`.
  - Keeps authenticated commercial buyers inside the dashboard layout (retaining sidebar, cart count, breadcrumbs) instead of navigating out to the public layout.
- **4. Transactional Multi-Farmer Checkout RPC (`place_checkout_orders` & `checkout-form.tsx`):**
  - Implemented `place_checkout_orders(p_orders JSONB)` in migration `20260924000002_launch_readiness_p1.sql`.
  - Processes multi-farmer checkouts inside a single PostgreSQL atomic transaction: validates all products/MOQ/stock across all farmers before creating any order.
  - If any product fails validation (e.g., out of stock), the entire batch rolls back atomically: 0 orders created, 0 stock deducted, cart items preserved.
  - Updated `src/app/(dashboard)/business/checkout/actions.ts` with `placeMultiFarmerCheckout` and connected `src/components/dashboard/checkout-form.tsx` to execute a single atomic call instead of a sequential loop.

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings across all files |
| **Production Build** | `npm run build` | ✅ **PASS** | 20 routes compiled cleanly via Turbopack |
| **Stock Restitution** | Automated SQL test | ✅ **PASS** | Stock restored exactly once on cancellation (+3kg); no double-restoration |
| **Public Data Privacy** | Anon PostgREST & RSC query | ✅ **PASS** | Neither `phone` nor `address` present in public product queries |
| **Business Nav Retention** | Route & component audit | ✅ **PASS** | Product cards in `/business` and `/business/products` route to `/business/products/[id]` |
| **Multi-Farmer Atomicity** | Atomic RPC rollback test | ✅ **PASS** | Batch rolls back atomically on failure; 0 orphan orders, 0 stock deducted |
| **Database Migration** | `npx supabase db push` | ✅ **PASS** | `20260924000002_launch_readiness_p1.sql` applied successfully to remote DB |

---

### Feature A — Smart Search & Discovery (`feat/smart-search` → `main`) (Complete & Live in Production ✅)
- **1. Database Schema & Functional GIN Trigram Indexes (`20260926000001_smart_search.sql` & `20260926000002_smart_search_hardening.sql`):**
  - Enabled `pg_trgm` extension in `extensions` schema.
  - Implemented functional GIN trigram indexes on `LOWER(name)`, `LOWER(description)`, `LOWER(categories.name)`, `LOWER(profiles.business_name)`, and `LOWER(profiles.full_name)` enabling bitmap index scan query planning.
  - Added composite index on `products(status, category_id, quantity_available)`.
- **2. Authoritative Hardened PostgreSQL RPC (`search_products`):**
  - Implemented `search_products(p_search, p_category_slug, p_in_stock_only, p_sort, p_limit, p_offset)` with `SECURITY DEFINER` and fixed `search_path = public, extensions, pg_temp;`.
  - Multi-field weighted scoring (`products.name` > `categories.name` > `profiles.business_name`/`full_name` > `products.description`).
  - Punctuation-only search guard (e.g. `???`, `!@#$%` return 0 results cleanly, avoiding unintended full-catalog exposure).
  - Parameter bounds clamping (`p_search` <= 100 chars, `p_limit` in [1, 100], `p_offset` >= 0, `p_category_slug` normalized).
  - Safe nullable relationship projections: returns SQL `NULL` for category/farmer instead of dummy objects with null properties.
  - Server-side atomic category and in-stock filtering before pagination (resolving PostgREST in-memory filter truncation bug).
  - Accurate windowed `total_count` and relevance ranking `search_rank` in a single round-trip.
  - Farmer profile projection strictly excludes private fields (`phone`, `address`).
- **3. Application & Query Layer Integration:**
  - Upgraded `getActiveProducts` and added `searchActiveProducts` in `src/lib/supabase/queries/products.ts`.
  - Added "Most Relevant" (`relevance`) sorting option across marketplace and business browsing views.
  - Added inline clear search button (`RiCloseCircleLine`) in `ProductFilters` with automatic relevance sort reset to `newest`.
  - Updated `/products` and `/business/products` to default to `relevance` sort when a search query is active.
- **4. Automated Pre-Merge Test Verification:**
  - Created 26-case test suite (`scripts/verify-smart-search.ts`) covering typo tolerance ("Tomatp" -> "Tomatoes", "petchay", "talongg", "camot"), multi-word queries, farmer discovery, category matching, combined filtering/sorting, SQL injection safety, draft exclusion, privacy, punctuation-only handling, cross-category isolation, 500-char input resilience, RPC parameter clamping, and null relationship payloads.
- **5. Pull Request Merge & Release:**
  - PR #24 (`feat(search): smart search and discovery`) approved and merged into `main` at commit `be74155283e2260eeea1f2adabf858f21b1e839b`.
- **6. Production Deployment & Incident Recovery:**
  - *Incident Summary:* Following PR #24 merge to `main`, Vercel automatic continuous deployment deployed `be74155` to `https://uma.xalhexi.wtf`. Because production Supabase (`odnpkqjytrmciwmcehff`) had not yet had migrations `20260926000001` and `20260926000002` applied, Next.js Server Components calling `getActiveProducts` encountered `PGRST202: Could not find the function public.search_products(...)`, surfacing server error digest `3154098985@E394` on `/` and `/products`.
  - *Resolution:* Root cause definitively diagnosed via read-only Vercel and Supabase schema cache inspection. Authorized forward deployment applied migrations `20260926000001_smart_search.sql` and `20260926000002_smart_search_hardening.sql` via `npx supabase db push`. PostgREST schema cache immediately updated, instantly clearing `PGRST202` and restoring all routes to healthy status without application rollback or code modification.
- **7. Production Verification & Live Smoke Tests (`odnpkqjytrmciwmcehff` & `https://uma.xalhexi.wtf`):**
  - Database: All 11 remote migrations synchronized with local codebase (`npx supabase migration list`). `pg_trgm` v1.6 and functional GIN trigram indexes active. Execute permissions granted to `anon`, `authenticated`, and `service_role`.
  - RPC Smoke Tests: NULL search returns full catalog (24 items); normal search ('tomato') returns 2 matches; typo search ('Tomatp') matches 'Tomato' and 'Ampayon Fresh Red Tomatoes'; punctuation ('???') returns 0; SQL injection text safely handled with 0 rows; parameter limit capped <= 100.
  - Privacy & Status: Farmer phone and address verified 100% excluded; only active listings returned (zero draft/archived exposure).
  - Live HTTP Probing: `/`, `/products`, `/about`, and `/api/health` return HTTP 200 with zero error digests; `/products?q=Tomatp` renders typo-tolerant tomato listings in production HTML.

| Test Item | Verification Method | Result | Verification Details |
|---|---|---|---|
| **ESLint Quality Pass** | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings across all files |
| **Production Build** | `npm run build` | ✅ **PASS** | 38 routes compiled cleanly via Turbopack |
| **Smart Search Pre-Merge Suite** | `scripts/verify-smart-search.ts` | ✅ **PASS** | 26/26 test cases passed against remote test DB |
| **Typo Tolerance** | Trigram word similarity | ✅ **PASS** | "Tomatp" matched "Ampayon Fresh Red Tomatoes" |
| **Producer Discovery** | Farmer name/business trigram | ✅ **PASS** | "Verdant Ridge" & "Golden Harvest" returned active listings |
| **Punctuation Guard** | Alphanumeric validation | ✅ **PASS** | "???" and "!@#$%" return 0 results cleanly |
| **Cross-Category Isolation** | Database query assertion | ✅ **PASS** | "bangus" in "vegetables" returns 0 rows |
| **Long Query Resilience** | Bounded trigram execution | ✅ **PASS** | 525-character query safely executes in 126ms |
| **RPC Bounds Clamping** | Parameter normalization | ✅ **PASS** | Limit clamped <= 100; negative offset clamped; empty slug normalized |
| **Null Relationship JSON** | Conditional JSON aggregation | ✅ **PASS** | Category/farmer return strict null when absent |
| **Security & Privacy** | DB query assertion | ✅ **PASS** | Drafts excluded; farmer phone/address omitted from payload |
| **SQL Injection Resilience** | Parameterized string test | ✅ **PASS** | Safe literal escaping; 0 false matches |
| **Production Migrations** | `npx supabase db push` | ✅ **PASS** | Migrations `20260926000001` & `20260926000002` applied to `odnpkqjytrmciwmcehff` |
| **Migration Synchronization** | `npx supabase migration list` | ✅ **PASS** | 11/11 migrations synchronized between local and remote |
| **Production RPC Smoke Tests** | Supabase JS client vs prod | ✅ **PASS** | NULL query, 'tomato', typo 'Tomatp', '???', injection, limit clamp all passed |
| **Production Farmer Privacy** | Prod DB payload assertion | ✅ **PASS** | `phone` and `address` fields 100% excluded from public payload |
| **Production Live HTTP** | Live fetch against `uma.xalhexi.wtf` | ✅ **PASS** | HTTP 200 on `/`, `/products`, `/products?q=Tomatp`; server error digest gone |

---

## Milestone Summary
- **Slice 1:** ✅ Complete & Verified
- **Slice 2:** ✅ Complete & Verified Across All Requirements
- **Slice 3:** ✅ Complete & Verified Across All Checkpoints & Security Matrix
- **Slice 4:** ✅ Complete & Verified Across Checkpoints 4.1, 4.2, 4.3 & 4.4
- **Slice 5:** ✅ Complete & Verified Across Checkpoints 5.1, 5.2, 5.3 & 5.4
- **Slice 6:** ✅ Complete & Verified Across Checkpoints 6.1–6.5, QA Polish & Landing Page Polish
- **Public Marketplace:** ✅ Complete & Verified (/products & /products/[id])
- **Brand, Navbar & CTA Polish:** ✅ Complete & Verified (Transparent-to-solid navbar, brand mark, favicons, CTA hierarchy)
- **Public Experience UX/UI Refinement:** ✅ Complete & Verified (Fresh on UMA product rail, verified produce photography, navbar deduplication, and streamlined marketplace discovery)
- **Physical Hardware SaaS Showcase Refinement:** ✅ Complete & Verified (2 physical laptops, 1 smartphone, real UMA screens, full code simplification, 0 lint errors, and 35 compiled routes)
- **Final Public Landing Refinement:** ✅ Complete & Verified (Visual composition, oversized asymmetric bleed, restrained buyer trust, dark mode + "D" shortcut, /about route, 0 lint errors, and 36 compiled routes)
- **Product Content & Image Audit (`feat/product-content-audit`):** ✅ Complete & Verified (24 produce listings audited, 11 photo mismatches corrected in storage, branded fallback placeholder `/product-placeholder.svg`, client-safe `ProductImage` fallback component, 0 lint errors, 34 compiled routes)
- **Visual Correction — Device Mockups & Hardware Presentation:** ✅ Complete & Verified (2 large landscape iPad Pro tablets, 1 thick 3D titanium smartphone, real UMA UI, unclipped soft shadows, unified settling animations, 0 lint errors, and 36 compiled routes)
- **Product Media Gallery (`feat/product-media-gallery`):** ✅ Complete & Verified (`product_images` table, RLS policies, backfill, shadcn Carousel gallery, farmer multi-photo upload/edit up to 5 photos, safe deletion, 0 lint errors, and 35 compiled routes)
- **Launch Readiness P1 Fixes (`fix/launch-readiness`):** ✅ Complete & Verified (Stock restitution trigger, public farmer privacy, business dashboard navigation consistency, atomic multi-farmer checkout RPC, 0 lint errors, 20 compiled routes)
- **Feature A (Smart Search & Discovery):** ✅ **COMPLETE & LIVE IN PRODUCTION** (`main` @ `be74155`, PR #24 merged, migrations synchronized, live smoke tests passed, status healthy)
- **Feature B (Marketplace / Visual Polish):** ⏳ **NEXT ON ROADMAP**
