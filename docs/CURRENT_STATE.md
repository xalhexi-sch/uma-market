# UMA Market — Current State

**Source of Truth Document**  
*Last Updated: 2026-09-23*

---

## 1. Current Slice & Checkpoint

- **Current Slice:** **Slice 4 — Production Readiness, Visual Commerce & Mobile Polish**
- **Current Checkpoint:** Checkpoint 4.1 Completed (Visual Commerce & Supabase Storage)
- **Slice 3 Status:** ✅ **Complete & Fully Verified**
- **Slice 4 Status:** ⏳ **IN PROGRESS (Checkpoint 4.1 Verified)**

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

### Slice 4 — Production Readiness, Visual Commerce & Mobile Polish (In Progress ⏳)
- [x] **Checkpoint 4.1: Visual Commerce & Supabase Storage (Verified ✅):**
  - Added canonical `image_path TEXT` column to `public.products` (Migration `20260923000001_slice4_storage.sql`).
  - Created public Supabase Storage bucket `product-images` with 5MB limit and JPEG/PNG/WebP constraints.
  - Storage RLS: Public SELECT, authenticated farmer folder-isolated INSERT/UPDATE/DELETE (`products/{auth.jwt()->>'sub'}/*`).
  - Browser-authenticated direct upload via `useSupabase()` with active Clerk session; zero secret key exposure.
  - Farmer `ProductForm` client component with drag/click upload, live thumbnail preview, and removal.
  - Server Action validation checking path ownership (`products/${userId}/...`) before persisting `image_path`.
  - Dynamic CDN URL resolution (`getProductImageUrl`) on `ProductCard` and `/business/products/[id]`.

---

## 3. What Is Currently Being Worked On

- Proceeding to **Checkpoint 4.2: Discovery, Sorting & Trust Verification**.
  - Extending `getActiveProducts` with sorting (price low-high, harvest newest, alphabetical) and in-stock filtering.
  - Implementing admin verification workflow (`toggleProfileVerification` server action) in `/admin/farmers` and `/admin/businesses`.
  - Displaying green "Verified Local Producer" trust badge on product cards and farm profile.
  - Adding structured cancellation reason modal in `order-status-actions.tsx`.

---

## 4. Known Issues

- **None.** Build passes cleanly (25 routes compiled, 0 errors), ESLint passes with 0 warnings, remote Supabase database and RPCs verified.

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