# UMA Market — Current State

**Source of Truth Document**  
*Last Updated: 2026-09-23*

---

## 1. Current Slice & Checkpoint

- **Current Slice:** Transitioning to **Slice 3 — Communications, Operations & Platform Polish**
- **Current Checkpoint:** Slice 2 Verification Completed & Verified 100% Green
- **Slice 2 Status:** ✅ **Complete & Fully Verified**
- **Slice 3 Status:** ⏳ **READY TO IMPLEMENT**

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
- [x] **Build & Lint Verification:** `npm run build` (21 routes, 0 errors) and `npm run lint` (0 errors).

---

## 3. What Is Currently Being Worked On

- **Slice 3 Implementation:**
  1. Threaded Direct Messaging between buyers and farmers (`/business/messages`, `/farmer/messages`, `messages` table).
  2. Buyer and Farmer Profile Management (`/business/profile`, `/farmer/profile` with contact and location details).
  3. Admin Dashboard Enhancements (produce moderation, platform metrics, and user management).
  4. Platform Polish and UI consistency.

---

## 4. Known Issues

- **None.** Build passes cleanly, ESLint passes with 0 warnings, remote Supabase database and RPCs verified.

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

## 7. Latest Verification Results

- **Build (`npm run build`):** ✅ **PASS** (Exit code 0, 21 routes compiled)
- **Lint (`npm run lint`):** ✅ **PASS** (Exit code 0, zero warnings/errors)
- **Live Multi-User Verification:** ✅ **PASS** (All 15 verification criteria passed using real signed Clerk JWTs against remote Supabase)
- **Backend RPC Guards & Logic:** ✅ **PASS** (`place_order` and `update_order_status` verified for all valid and invalid cases)
- **Cross-Tenant Data Isolation:** ✅ **PASS** (RLS enforced across carts, orders, and products)