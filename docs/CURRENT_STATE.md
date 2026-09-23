# UMA Market — Current State

**Source of Truth Document**  
*Last Updated: 2026-09-23*

---

## 1. Current Slice & Checkpoint

- **Current Slice:** **Slice 4 — Production Readiness, Visual Commerce & Mobile Polish**
- **Current Checkpoint:** Checkpoint 4.4 Completed (Mobile Navigation & Production Hardening)
- **Slice 3 Status:** ✅ **Complete & Fully Verified**
- **Slice 4 Status:** ✅ **Complete & Fully Verified**

---

## 2. What Is Actually Complete

### Slice 1 — Platform Foundation (Verified ✅)
- [x] Clerk Authentication (`@clerk/nextjs` v7) with custom sign-in and sign-up pages
- [x] Custom onboarding wizard (`/onboarding`) setting Clerk `publicMetadata.role`
- [x] Role-based redirection logic sending users to `/farmer`, `/business`, or `/admin`
- [x] Supabase Native Third-Party Auth integration with Clerk session claims:
  - `role`: `"authenticated"`
  - `user_role`: `"{{user.public_metadata.role}}"`
- [x] Supabase PostgreSQL database schema with 7 core tables:
  - `profiles`, `categories`, `products`, `cart_items`, `orders`, `order_items`, `messages`
- [x] Active PostgreSQL Row-Level Security (RLS) policies on all 7 tables
- [x] Seeded agricultural categories (8 categories verified in remote DB)
- [x] Role dashboard scaffolding (Farmer, Business Buyer, Admin)
- [x] Public marketing landing page with live product highlights and UMA brand identity

### Slice 2 — Business Purchase Journey & Farmer Operations (Verified ✅)
- [x] **Product Catalog Browsing (`/business/products`):** Search by product name, category filters, and farm provenance.
- [x] **Product Detail View (`/business/products/[id]`):** Stock availability, MOQ rules, and Add-to-Cart controls.
- [x] **Shopping Cart System (`/business/cart`):** Per-farmer grouping with independent subtotals and real-time quantity mutations.
- [x] **Checkout Flow (`/business/checkout`):** Pickup and Seller Delivery options, delivery notes, and atomic multi-farmer order splitting.
- [x] **Order Confirmation & History (`/business/orders`, `/business/orders/[id]`):** Unique order reference, timeline tracking, and full line item snapshots.
- [x] **Farmer Inventory Management (`/farmer/products`):** Produce listing CRUD, availability toggling, and soft archival.
- [x] **Farmer Order Handling (`/farmer/orders`, `/farmer/orders/[id]`):** Incoming wholesale order queue, buyer contacts, and status progression controls.
- [x] **Backend Atomic RPCs (`place_order`, `update_order_status`):** Verified live with signed Clerk JWTs.
- [x] **Cross-Tenant Data Isolation & RLS Security:** Verified live with multi-user signed Clerk JWTs.

### Slice 3 — Communications, Operations & Platform Polish (Verified ✅)
- [x] **Buyer & Farmer Profile Operations (`/business/profile`, `/farmer/profile`):**
  - View and update contact name, business / farm name, phone number, city, delivery address / pickup notes, and bio.
  - Server Action `updateProfile` with user ownership authentication and RLS guard.
  - UI feedback with inline status badges, error handling, and toast-style success confirmation.
- [x] **Order-Threaded B2B Messaging:**
  - `messages` table integration with RLS enforcement (`messages: read participant`, `messages: send`).
  - Interactive chat component (`order-chat.tsx`) embedded directly on order detail pages (`/business/orders/[id]`, `/farmer/orders/[id]`).
  - Optimistic UI sending with automatic scroll-to-bottom and sender/receiver message styling.
  - Centralized conversation inbox for buyers (`/business/messages`) and farmers (`/farmer/messages`) with counterparty profiles and unread-safe listings.
- [x] **Admin Oversight & Moderation Dashboard:**
  - Executive KPI cards (`/admin`): Real-time metrics for total farmers, active buyers, catalog listings, and wholesale platform volume.
  - Produce Catalog Moderation (`/admin/products`): Full catalog table with status badges and one-click listing archive/restore Server Action (`moderateProductStatus`).
  - Platform Audit Log (`/admin/orders`): Global wholesale transactions table with status filters, timestamps, and customer tracking.
  - User Directories: Dedicated directory views for registered Farmers (`/admin/farmers`) and Commercial Buyers (`/admin/businesses`).
- [x] **Sidebar Navigation & Routing Alignment:**
  - Cleaned up navigation items in `src/components/dashboard/sidebar.tsx` removing any placeholder links.
  - All navigation links route to functional, styled pages with active route highlighting (16 routes verified with 0 404s).

### Slice 4 — Production Readiness, Visual Commerce & Mobile Polish (Complete ✅)
- [x] **Checkpoint 4.1: Visual Commerce & Supabase Storage (Verified ✅):**
  - Added canonical `image_path TEXT` column to `public.products` (Migration `20260923000001_slice4_storage.sql`).
  - Created public Supabase Storage bucket `product-images` with 5MB limit and JPEG/PNG/WebP constraints.
  - Storage RLS: Public SELECT, authenticated farmer folder-isolated INSERT/UPDATE/DELETE (`products/{auth.jwt()->>'sub'}/*`).
  - Browser-authenticated direct upload via `useSupabase()` with active Clerk session; zero secret key exposure.
  - Farmer `ProductForm` client component with drag/click upload, live thumbnail preview, and removal.
  - Server Action validation checking path ownership (`products/${userId}/...`) before persisting `image_path`.
  - Dynamic CDN URL resolution (`getProductImageUrl`) on `ProductCard` and `/business/products/[id]`.
- [x] **Checkpoint 4.2: Discovery, Sorting & Trust Verification (Verified ✅):**
  - Extended `getActiveProducts` query with strict `ProductSort` typing (`price_asc`, `price_desc`, `harvest_newest`, `name_asc`, `newest`) and `inStockOnly` filtering.
  - Added sorting dropdown and "In Stock Only" / "All Availability" select controls to `/business/products` with query parameter preservation across category navigation.
  - Implemented `toggleProfileVerification(targetClerkId, isVerified)` server action guarded by `user_role === 'admin'`.
  - Implemented interactive `AdminVerifyButton` in `/admin/farmers` and `/admin/businesses` directories with live optimistic UI state.
  - Displayed "Verified Local Producer" trust badge on `ProductCard` and product detail header when producer is verified.
  - Implemented structured cancellation reason modal flow in `order-status-actions.tsx` with preset reasons and custom detail notes, persisted via `update_order_status` RPC.
  - Verified 13/13 test cases against remote Supabase with signed Clerk JWTs.
- [x] **Checkpoint 4.3: Realtime Coordination & Operational Alerts (Verified ✅):**
  - Upgraded `OrderChat` component with Supabase Realtime Postgres Changes subscription for order-scoped `messages` INSERT events.
  - Integrated Clerk session token sync with Supabase Realtime WebSocket client in `useSupabase()`.
  - Implemented duplicate prevention and seamless optimistic-to-server message transition.
  - Verified bidirectional live chat between Commercial Buyer and Farmer without manual page reload.
  - Verified cross-tenant participant privacy (unrelated third-party receives 0 events; injection blocked by RLS).
  - Implemented operational sidebar badges for Farmers (pending review orders) and Commercial Buyers (ready / for_delivery orders) with automatic zero-count suppression.
  - Verified 8/8 test cases in live test suite against remote Supabase with multi-user signed Clerk JWTs.
- [x] **Checkpoint 4.4: Mobile Navigation & Production Hardening (Verified ✅):**
  - Implemented responsive mobile topbar (`md:hidden`) with hamburger toggle button (`RiMenuLine`), UMA Market branding, role badge, cart shortcut, and Clerk `UserButton`.
  - Implemented slide-over `Sheet` drawer (`side="left"`) with role-based navigation links, operational counter badges, active route highlighting, and automatic close on route selection (`setOpen(false)`).
  - Preserved existing desktop sidebar (`hidden md:flex`) and wrapped dashboard layout in `flex-col md:flex-row min-w-0` to eliminate horizontal overflow.
  - Created Next.js dashboard error boundary (`src/app/(dashboard)/error.tsx`) with UMA branding, retry action calling `reset()`, and secure development/production error boundary handling.
  - Responsive UI audit fixes:
    - Replaced `overflow-hidden` with `overflow-x-auto` on data table containers across orders and products pages.
    - Added responsive padding (`p-4 sm:p-6 lg:p-8`) on messages and profile pages, eliminating viewport edge collision.
    - Updated checkout fulfillment cards and produce pricing fields to responsive stacking (`grid-cols-1 sm:grid-cols-2`).
    - Standardized image resolution on `CartItemRow` with `getProductImageUrl`.
    - Polished public landing page hero composition and typography for mobile viewports (375px/390px).
  - UI Primitive Audit: Verified zero unsupported `Button asChild` instances across all components.
  - Verified 15/15 test cases in comprehensive automated test suite.

---

## 3. What Is Currently Being Worked On

- Slice 4 is **COMPLETE** and verified across all four checkpoints (4.1, 4.2, 4.3, 4.4).
- Production-readiness checkpoint complete. Ready for next phase directives.

---

## 4. Known Issues

- **None.** Build passes cleanly (29 routes compiled via Turbopack, 0 errors), ESLint passes with 0 warnings/errors, remote Supabase database and RLS policies verified.

---

## 5. Technology Stack

- **Framework:** Next.js 16.3.5 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4, shadcn/ui design tokens (`@base-ui/react`), Remix Icons (`@remixicon/react`), Lucide React
- **Authentication:** Clerk (`@clerk/nextjs` v7)
- **Database:** Supabase PostgreSQL (`@supabase/supabase-js`, `@supabase/ssr`)
- **Database Security:** PostgreSQL Row-Level Security (RLS)
- **Database Tooling:** Supabase CLI, declarative SQL migrations

---

## 6. Authentication & Authorization Architecture

- **Authentication Provider:** Clerk handles identity and session tokens.
- **Database Provider:** Supabase PostgreSQL stores application data.
- **Third-Party Auth Integration:** Clerk is configured directly as Supabase's third-party auth provider.
- **Session Claims:**
  ```json
  {
    "role": "authenticated",
    "user_role": "{{user.public_metadata.role}}"
  }
  ```
- **PostgreSQL Identity Mapping:**
  - `auth.jwt()->>'sub'` = Authenticated Clerk User ID.
  - `auth.jwt()->>'user_role'` = UMA Application Role (`farmer`, `business`, `admin`).
- **Authorization Rules:**
  - Do NOT use `auth.uid()`.
  - Do NOT use `auth.jwt()->>'role'` for application role checks.
  - Resource-level authorization in Server Actions and layouts.
  - Database authorization in PostgreSQL Row-Level Security policies.
  - `src/proxy.ts` runs standard `clerkMiddleware()` only.

---

## 7. Latest Verification Results (Slice 3 Live QA)

- **Build (`npm run build`):** ✅ **PASS** (Exit code 0, 25 routes compiled cleanly with Turbopack)
- **Lint (`npm run lint`):** ✅ **PASS** (Exit code 0, zero warnings/errors)
- **Farmer Profile Operations:** ✅ **PASS** (Loaded live profile, updated bio/phone via RLS, refreshed verification)
- **Business Profile Operations:** ✅ **PASS** (Loaded live profile, updated bio/phone via RLS, refreshed verification)
- **Profile Cross-User Security:** ✅ **PASS** (Buyer2, Farmer2, and Buyer1 blocked from modifying unowned profiles; 0 rows affected)
- **Order-Threaded Messaging (Business Send):** ✅ **PASS** (Sent message on real order `2c33a782-...`, persisted in remote `messages` table)
- **Order-Threaded Messaging (Farmer Read):** ✅ **PASS** (Farmer queried and received message via RLS participant policy)
- **Order-Threaded Messaging (Farmer Reply):** ✅ **PASS** (Farmer sent reply, persisted in remote `messages` table)
- **Order-Threaded Messaging (Business Read):** ✅ **PASS** (Business queried and received reply via RLS participant policy)
- **Messaging Cross-Tenant Privacy:** ✅ **PASS** (Unrelated Buyer2 and Farmer2 queried conversation and received 0 rows via RLS)
- **Messaging Anti-Tamper & Anti-Spoofing:** ✅ **PASS** (Unrelated insertion blocked by RLS; spoofing sender ID blocked by RLS)
- **Admin Live Metrics:** ✅ **PASS** (2 farmers, 2 buyers, 2 active produce items, ₱1,625 volume)
- **Admin Produce Catalog & Moderation:** ✅ **PASS** (Archived produce and restored to active; verified in database)
- **Admin Audit Log & Directories:** ✅ **PASS** (Wholesale orders audit and user directories queried successfully)
- **Admin Server-Side Action Protection:** ✅ **PASS** (Non-admin claims rejected from `moderateProductStatus`)
- **Navigation Integrity:** ✅ **PASS** (All 16 dashboard routes verified; zero 404 errors)