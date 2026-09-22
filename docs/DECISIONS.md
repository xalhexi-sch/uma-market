# UMA Market — Settled Architectural & Product Decisions

**Persistent Project Memory Document**  
*Last Updated: 2026-09-23*

This document records the binding architectural, product, and engineering decisions for UMA Market. Any coding agent, developer, or system resuming work on this repository must honor these decisions.

---

## 1. Authentication

- **Provider:** **Clerk** (`@clerk/nextjs` v7).
- **Rationale:** Handles identity, password hashing, multi-factor authentication, email verification, session rotation, and role-bearing user metadata without maintaining custom auth infrastructure.
- **Integration with Database:** Clerk is configured natively as Supabase's third-party auth provider. Clerk session JWTs are forwarded to the Supabase client as Bearer tokens.
- **Claims Mapping:**
  ```json
  {
    "role": "authenticated",
    "user_role": "{{user.public_metadata.role}}"
  }
  ```
- **Rule:** Do NOT introduce Prisma, NextAuth, Auth0, or custom JWT authentication servers.

---

## 2. Database & Data Storage

- **Provider:** **Supabase PostgreSQL**.
- **Schema Management:** Declarative SQL migrations located in `supabase/migrations/` managed via Supabase CLI.
- **Client Strategy:**
  - Browser Client (`src/lib/supabase/client.ts`): Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  - Server Client (`src/lib/supabase/server.ts`): Passes active Clerk session token to authenticate PostgreSQL queries against Row-Level Security policies.
  - Admin Client (`src/lib/supabase/admin.ts`): Restricted strictly to server-only administrative operations using `SUPABASE_SECRET_KEY`. Bypasses RLS. Never exposed to browser bundles.
- **Rule:** Do NOT use an ORM (Prisma, Drizzle, etc.). Rely on typed Supabase PostgREST client queries and declarative SQL.

---

## 3. Authorization & Security Model

- **Layer 1 — Database Row-Level Security (RLS):**
  - All core tables have RLS enabled.
  - Policies identify the user via `auth.jwt()->>'sub'` (Clerk User ID).
  - Policies enforce UMA roles via `auth.jwt()->>'user_role'` (`farmer`, `business`, `admin`).
  - **Rule:** Do NOT use `auth.uid()` (incompatible with Clerk third-party auth).
  - **Rule:** Do NOT use `auth.jwt()->>'role'` for application role checks (always `'authenticated'`).
- **Layer 2 — Server & Resource-Level Authorization:**
  - Server Actions and Server Component layouts verify user ownership and permissions directly before processing mutations.
- **Layer 3 — Edge / Middleware:**
  - `src/proxy.ts` runs standard `clerkMiddleware()` for session establishment.
  - **Rule:** `proxy.ts` does NOT contain role-based routing tables, route matchers (`createRouteMatcher`), or RBAC redirect loops.

---

## 4. System Roles

- **Roles:** Exactly three roles exist in the system:
  1. `farmer`
  2. `business`
  3. `admin`
- **Rule:** Do NOT introduce sub-roles (e.g., driver, courier, dispatcher, guest buyer).

---

## 5. Fulfillment Model

- **Supported Modes:**
  1. `pickup` (Buyer collects harvest directly from the farm gate or designated station)
  2. `seller_delivery` (Farmer delivers produce consignment directly to the buyer's business address)
- **Explicit Scope Discipline:**
  - No third-party courier network or driver gig-economy app.
  - No automated dispatch systems or delivery bidding.
  - No real-time GPS tracking or route mapping.

---

## 6. Order Architecture & Split Checkout

- **Rule:** When a business buyer's cart contains produce from multiple distinct farmers, checkout generates **separate, independent orders per farmer**.
- **Rationale:** Each farmer manages their own harvest, pack-out schedule, inventory levels, and delivery logistics independently. Farmers cannot fulfill orders on behalf of other producers.
- **Atomicity:** Order placement is executed via the `place_order` PostgreSQL RPC to ensure that order creation, line item insertion, stock decrement, and cart clearing occur within a single atomic database transaction.

---

## 7. Historical Order Integrity

- **Rule:** `order_items` stores historical snapshots of `product_name`, `unit`, and `unit_price` at the moment of order placement.
- **Rationale:** If a farmer later edits a product's price, renames the produce, or archives the listing, past receipts, invoices, and accounting records remain immutable.
- **Price Authority:** The product price is re-read server-side from the database inside `place_order`. Prices submitted by the client are ignored.

---

## 8. Product Archival

- **Rule:** Products are never hard-deleted once created. They are archived (`status = 'archived'`).
- **Rationale:** Hard-deleting produce records breaks foreign key references in historical `order_items` and invalidates past order tracking.

---

## 9. Payments (MVP Scope)

- **Status:** **Out of scope for current MVP.**
- **Rationale:** Commercial agricultural trade in Butuan City operates via cash on delivery (COD), bank transfers, or established post-delivery settlement terms. Digital payment escrow will be considered in future iterations after core ordering is stabilized.

---

## 10. Product Imagery & Storage

- **Status:** **Future scope.**
- **Current Approach:** Standardized category badges and curated local photography.
- **Rationale:** Supabase Storage bucket integration will be introduced in an upcoming slice to avoid blocking core commerce workflows on image upload pipelines.

---

## 11. Scope Discipline Principle

- **Core Rule:** Do NOT add features simply because other consumer marketplaces have them.
- **Evaluation Filter:** Every capability must directly serve the core problem: **enabling predictable, direct B2B agricultural procurement between local Butuan farmers and commercial food establishments**.