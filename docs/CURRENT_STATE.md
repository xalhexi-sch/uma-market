# UMA Market — Current State

**Source of Truth Document**  
*Last Updated: 2026-09-23*

---

## 1. Current Slice & Checkpoint

- **Current Slice:** Slice 2 — Business Purchase Journey & Farmer Operations
- **Current Checkpoint:** Slice 2 Final Verification, Persistent Project Memory & Documentation Checkpoint
- **Slice 3 Status:** **NOT STARTED**

---

## 2. What Is Actually Complete

### Slice 1 — Platform Foundation
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

### Slice 2 — Business Purchase Journey & Farmer Operations
- [x] **Product Catalog Browsing (`/business/products`):**
  - Search by product name (case-insensitive `ilike`)
  - Filter by category slug via joined PostgREST query
  - Product cards displaying price/unit, MOQ, stock availability, and farm provenance
- [x] **Product Detail View (`/business/products/[id]`):**
  - Farmer profile metadata join (`business_name`, `full_name`, `city`, `phone`)
  - Real-time stock display and minimum purchase requirements
  - Interactive Add-to-Cart controls
- [x] **Shopping Cart System (`/business/cart`):**
  - Automatic per-farmer grouping with independent farm subtotals
  - Real-time quantity mutations and item removal
  - Header cart counter badge linked to `cart_items` count
- [x] **Checkout Flow (`/business/checkout`):**
  - Fulfillment mode selection: **Pickup** vs **Seller Delivery**
  - Shipping address and delivery notes input
  - Summary review per farmer with atomic order placement
- [x] **Order Confirmation & History (`/business/orders`):**
  - Unique order reference display
  - Order history listing with status filters
  - Detailed order view (`/business/orders/[id]`) with status timeline and line items
- [x] **Farmer Inventory Management (`/farmer/products`):**
  - Create new produce listings (`/farmer/products/new`) with category, pricing, stock, unit, MOQ, and harvest dates
  - Edit active listings (`/farmer/products/[id]/edit`)
  - Archive listings (soft delete to preserve historical order integrity)
- [x] **Farmer Order Handling (`/farmer/orders`):**
  - Incoming orders dashboard with buyer contact and delivery instructions
  - Detailed order view (`/farmer/orders/[id]`) with line item inspection
  - Lifecycle status transition controls (`pending` → `accepted` → `preparing` → `ready` → `for_delivery` / `completed`)
- [x] **Backend Atomic RPCs (`supabase/migrations/20260922000002_slice2_schema.sql`):**
  - `place_order`: SECURITY DEFINER function validating caller identity (`auth.jwt()->>'sub'`), role (`user_role = 'business'`), minimum order quantities, stock availability, product active status, and single-farmer consistency; inserts order and line items (with price/name/unit snapshots), decrements inventory stock, and clears buyer cart atomically.
  - `update_order_status`: SECURITY DEFINER function validating farmer ownership and enforcing strict state-machine transitions.
- [x] **Official GitHub Repository & Brand Asset Integration:**
  - Remote repository `xalhexi-sch/uma-market` initialized, connected, and pushed to `main` branch.
  - Comprehensive, professionally styled `README.md` using official UMA brand assets (`public/brand/logo/uma-logo-primary.png`).
  - Zero secrets committed (`.env*` excluded, `.env.example` created).

---

## 3. What Is Currently Being Worked On

- Project memory consolidation (`docs/CURRENT_STATE.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`).
- Final Slice 2 verification documentation and plan reconciliation.
- Maintaining clean git repository state prior to starting Slice 3.

---

## 4. Known Issues

- **None.** Build compiles with zero errors, ESLint reports zero warnings, all 7 database tables are active with verified schema columns and foreign key constraints, and RPC auth guards are active.

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

- **Authentication Provider:** Clerk handles identity, passwords, email verification, and session tokens.
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
  - **Do NOT use `auth.uid()`** (returns NULL or unexpected UUID with Clerk third-party auth).
  - **Do NOT use `auth.jwt()->>'role'`** for UMA application permissions (always equals `'authenticated'`).
  - **Resource-level authorization** is performed inside Server Actions and Server Component layouts.
  - **Database authorization** is enforced via PostgreSQL Row-Level Security policies.
  - `src/proxy.ts` runs standard `clerkMiddleware()` only. It does **NOT** contain role-based route matchers or RBAC redirect tables.

---

## 7. User Roles

- **`farmer`:** Produces and lists fresh agricultural crops, sets bulk units and MOQ, manages inventory, and fulfills wholesale orders.
- **`business`:** Commercial buyers (restaurants, caterers, hotels, institutions) that discover local produce, manage shopping carts, submit orders, and track fulfillment.
- **`admin`:** Platform governance, category management, and marketplace policy enforcement.

---

## 8. Fulfillment Model

- **`pickup`:** Commercial buyer collects produce directly from the farm gate or designated aggregation hub.
- **`seller_delivery`:** Farmer delivers harvest consignment directly to the buyer's commercial address.
- **Explicit Exclusions (Scope Discipline):**
  - No third-party courier network or driver app.
  - No GPS tracking or real-time map routing.
  - No automated dispatch or delivery bidding.

---

## 9. Core Database Tables

1. `profiles`: User details, role, business/farm name, phone, city, bio. Keyed by `clerk_id`.
2. `categories`: Agricultural classifications (Vegetables, Fruits, Rice & Grains, Root Crops, Herbs & Spices, Poultry & Eggs, Fish & Seafood, Other).
3. `products`: Produce catalog items with pricing, unit, stock, MOQ, harvest dates, and active status.
4. `cart_items`: Per-business shopping cart items with quantity and product reference.
5. `orders`: Wholesale purchase orders with fulfillment type, status, delivery address, notes, and totals.
6. `order_items`: Immutable line items storing price snapshots, product names, units, and subtotals.
7. `messages`: Threaded communication between order participants.

---

## 10. Latest Verification Results

- **Build (`npm run build`):** ✅ **PASS** (Exit code 0, 21 static/dynamic routes compiled via Turbopack)
- **Lint (`npm run lint`):** ✅ **PASS** (Exit code 0, zero warnings/errors)
- **Database Connection & Schema:** ✅ **PASS** (Connected to remote Supabase, all 7 tables accessible)
- **Foreign Key PostgREST Joins:** ✅ **PASS** (Verified joins across `products`, `profiles`, `categories`, `orders`, and `order_items`)
- **Backend RPC Security Guards:** ✅ **PASS** (`place_order` and `update_order_status` reject unauthenticated calls with `"Not authenticated"`)
- **Unauthenticated Route Protection:** ✅ **PASS** (Unauthorized visits to `/business/*` and `/farmer/*` redirect to `/sign-in`)