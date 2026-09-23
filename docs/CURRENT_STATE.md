# UMA Market — Current State

**Source of Truth Document**  
*Last Updated: 2026-09-23 (Slice 6 started)*

---

## 1. Current Slice & Checkpoint

- **Current Slice:** **Slice 6 — Production Deployment**
- **Current Checkpoint:** 6.1 Code Hardening ✅ | 6.2–6.5 Awaiting Manual Configuration
- **Slice 1 Status:** ✅ **Complete & Fully Verified**
- **Slice 2 Status:** ✅ **Complete & Fully Verified**
- **Slice 3 Status:** ✅ **Complete & Fully Verified**
- **Slice 4 Status:** ✅ **Complete & Fully Verified**
- **Slice 5 Status:** ✅ **Complete & Fully Verified**
- **Slice 6 Status:** ⏳ **In Progress (Checkpoint 6.1 Complete)**

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

### Slice 5 — Pilot Readiness & Operational Integrity (Verified ✅)
- [x] **Checkpoint 5.1: Structural Integrity & User Feedback:**
  - Base UI Toaster integration in root layout with typed helpers (`toast.success`, `toast.error`, `toast.info`, `toast.warning`).
  - Toast feedback wired across profile forms, product creation/editing, cart adds, order cancellations, and admin moderation.
  - Branded 404 pages: Global (`src/app/not-found.tsx`) and Dashboard (`src/app/(dashboard)/not-found.tsx`).
  - Skeleton loading states (`loading.tsx`) across all 10 primary dashboard routes.
  - Buyer pending-order cancellation with confirmation dialog (`CancelOrderButton`) and `cancelOrder` server action enforcing RLS policy `"orders: business cancels pending"`.
- [x] **Checkpoint 5.2: Profile Resilience & Clerk Webhook:**
  - Clerk Webhook route handler (`src/app/api/webhooks/clerk/route.ts`) with cryptographic signature verification via `verifyWebhook(req)`.
  - Lifecycle event handling: stub creation for `user.created`, non-destructive logging and missing-profile restoration for `user.updated`, and produce archival for `user.deleted`.
  - Profile recovery banner in `(dashboard)/layout.tsx` when a profile record is missing.
  - Documented `CLERK_WEBHOOK_SIGNING_SECRET` in `.env.example`.
- [x] **Checkpoint 5.3: Realistic Demo Data & Marketplace Seed:**
  - Idempotent seed script (`scripts/seed-demo-data.ts`) executable via `npm run seed:demo`.
  - 4 fictional demo farmers and 2 fictional commercial buyers.
  - 21 wholesale products across all 8 catalog categories with market-accurate ₱ prices, stock, and MOQs.
  - 21 high-resolution produce photographs uploaded to Supabase Storage `product-images` bucket.
  - 4 wholesale orders across pending, preparing, completed, and cancelled states with item snapshots.
- [x] **Checkpoint 5.4: Admin Completeness & Operational Polish:**
  - Admin order detail inspection page (`/admin/orders/[id]`) with counterparty profiles, fulfillment logistics, line item breakdown, and read-only message audit log.
  - Clickable order reference links in `/admin/orders` table.
  - Farmer dashboard revenue summary (total from completed orders) and fulfillment rate KPI cards.
  - Actionable CTAs in empty states for orders, products, and messages.

### Slice 6 — Production Deployment (In Progress)
- [x] **Checkpoint 6.1: Production Code Hardening:**
  - Removed hardcoded Supabase URL fallback in `src/lib/supabase/storage.ts` — env var is sole source of truth.
  - Created `/api/health` endpoint returning `{ status, version, timestamp }` for deployment verification.
  - Created `public/robots.txt` allowing public landing page crawling, blocking dashboard/auth/API routes.
  - Added `metadataBase` to root layout using `NEXT_PUBLIC_APP_URL` for production URL resolution.
  - Enhanced OpenGraph metadata with `siteName`, `locale`, and `robots` configuration.
  - Updated `.env.example` with production vs. development documentation, environment separation guidance, and `NEXT_PUBLIC_APP_URL`.
- [ ] **Checkpoint 6.2: Vercel Project & GitHub Integration** — Requires manual Vercel account + project setup.
- [ ] **Checkpoint 6.3: Clerk Production Instance** — Requires manual Clerk Dashboard configuration.
- [ ] **Checkpoint 6.4: Domain & DNS** — Requires domain purchase and DNS configuration.
- [ ] **Checkpoint 6.5: Production Verification & Launch Checklist** — End-to-end verification on live deployment.

---

## 3. What Is Currently Being Worked On

- Slice 6 Checkpoint 6.1 (Production Code Hardening) is **COMPLETE**.
- **Next steps require manual actions:** Vercel project creation, Clerk production instance, domain + DNS, Supabase TPA re-configuration.
- See `implementation_plan.md` for the full Slice 6 checklist and manual action guide.

---

## 4. Known Issues

- **None.** Build passes cleanly (32 routes compiled via Turbopack, 0 errors), ESLint passes with 0 warnings and 0 errors, remote Supabase database, storage bucket, and RLS policies verified.

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

## 7. Latest Verification Results (Slice 6 Checkpoint 6.1)

- **Build (`npm run build`):** ✅ **PASS** (Exit code 0, 32 routes compiled cleanly with Turbopack)
- **Lint (`npm run lint`):** ✅ **PASS** (Exit code 0, zero warnings, zero errors)
- **Health Check Endpoint:** ✅ **PASS** (`/api/health` route compiled and returns `{ status: "ok" }`)
- **robots.txt:** ✅ **PASS** (Served from `public/robots.txt`, blocks dashboard/auth routes)
- **Hardcoded URL Removed:** ✅ **PASS** (`storage.ts` uses `process.env.NEXT_PUBLIC_SUPABASE_URL!` exclusively)
- **Production Metadata:** ✅ **PASS** (`metadataBase`, OpenGraph `siteName`/`locale`, `robots` configured)