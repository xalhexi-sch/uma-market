# UMA Market — Current State

**Source of Truth Document**  
*Last Updated: 2026-09-23 (Slice 6 started)*

---

## 1. Current Slice & Checkpoint

- **Current Slice:** **Feature A: Smart Search & Discovery (`feat/smart-search`)**
- **Current Checkpoint:** Feature A: Smart Search & Discovery (`feat/smart-search`) ✅ | Launch Readiness P1 Fixes (`fix/launch-readiness`) ✅ | Security Hardening & Concurrency Remediation ✅ | Product Media Gallery (`feat/product-media-gallery`) ✅ | Production Deployment Verified ✅
- **Slice 1 Status:** ✅ **Complete & Fully Verified**
- **Slice 2 Status:** ✅ **Complete & Fully Verified**
- **Slice 3 Status:** ✅ **Complete & Fully Verified**
- **Slice 4 Status:** ✅ **Complete & Fully Verified**
- **Slice 5 Status:** ✅ **Complete & Fully Verified**
- **Slice 6 Status:** ✅ **Complete & Fully Verified**
- **Product Media Gallery Status:** ✅ **Complete & Fully Verified**
- **Launch Readiness P1 Status:** ✅ **Complete & Fully Verified**
- **Feature A Status:** ✅ **Complete & Fully Verified (20/20 Test Cases Passed)**

---

## 2. What Is Actually Complete

### Feature A — Smart Search & Discovery (Verified ✅)
- [x] **PostgreSQL pg_trgm Extension & Specialized GIN Indexes (`20260926000001_smart_search.sql`):**
  - Enabled `pg_trgm` extension in `extensions` schema.
  - Added GIN trigram indexes on `products.name`, `products.description`, `categories.name`, `profiles.business_name`, and `profiles.full_name`.
  - Added composite B-Tree index on `products (status, category_id, quantity_available)`.
- [x] **Authoritative Search RPC (`search_products`):**
  - Multi-field weighted scoring (`products.name` > `categories.name` > `profiles.business_name`/`full_name` > `products.description`).
  - Strict noise threshold cutoff preventing false matches on random or special-character queries.
  - Server-side atomic category and in-stock filtering before pagination (resolving PostgREST in-memory filter truncation bug).
  - Atomic `total_count` window calculation for pagination.
  - Public data protection: farmer profile projection strictly excludes `phone` and `address`.
- [x] **Query & UI Integration:**
  - Upgraded `getActiveProducts` and added `searchActiveProducts` in `src/lib/supabase/queries/products.ts`.
  - Added "Most Relevant" (`relevance`) sorting option across marketplace and business browsing views.
  - Added inline clear search button (`RiCloseCircleLine`) in `ProductFilters`.
- [x] **Automated Test Verification:**
  - 20/20 automated test cases passed via `scripts/verify-smart-search.ts`.
  - Zero ESLint errors/warnings (`npm run lint`).
  - Clean Next.js compilation across all 38 routes (`npm run build`).

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

### Slice 6 — Production Deployment & QA Polish (Complete ✅)
- [x] **Checkpoint 6.1: Production Code Hardening:**
  - Removed hardcoded Supabase URL fallback in `src/lib/supabase/storage.ts` — env var is sole source of truth.
  - Created `/api/health` endpoint returning `{ status, version, timestamp }` for deployment verification.
  - Created `public/robots.txt` allowing public landing page crawling, blocking dashboard/auth/API routes.
  - Added `metadataBase` to root layout using `NEXT_PUBLIC_APP_URL` for production URL resolution.
  - Enhanced OpenGraph metadata with `siteName`, `locale`, and `robots` configuration.
  - Updated `.env.example` with production vs. development documentation, environment separation guidance, and `NEXT_PUBLIC_APP_URL`.
- [x] **Checkpoint 6.2–6.5: Production Deployment Verification (Manually Verified):**
  - Vercel production deployment + custom domain
  - Clerk Production instance + Google OAuth
  - Clerk → Supabase Third-Party Auth integration
  - Farmer & Business onboarding wizard
  - Admin moderation dashboard
  - Product creation + Supabase Storage direct uploads (exp claim timestamp check resolved)
  - Wholesale orders & checkout flows
  - Message persistence & webhook delivery
  - Bot sign-up protection
- [x] **Production QA Polish (Verified ✅):**
  - **Realtime Chat Live Delivery:** Migrated browser client from `@supabase/ssr` to direct `@supabase/supabase-js` `createClient` with dynamic `accessToken` callback. In `OrderChat`, asynchronously retrieved fresh Clerk JWT via `getToken()` and primed `supabase.realtime.setAuth(token)` before calling `channel.subscribe()`, ensuring Phoenix join payload contains `access_token` so Supabase Realtime authorizes the `postgres_changes` RLS policy without requiring recipient refresh. Reconciled optimistic messages immediately on send success.
  - **Onboarding Loading Feedback:** Extracted onboarding form to `OnboardingForm` client component with immediate loading feedback on the "Continue" submit button (disabled state, animated `Spinner`, "Setting up your account…" text), duplicate submission prevention, and fieldset disablement during submission while preserving existing Clerk metadata updates, Supabase profile creation, and `/onboarding/complete` session refresh redirects.
  - **Authenticated Root Routing:** Removed automatic role-based redirect from root landing page `/`. The public marketplace landing page `/` remains accessible to all visitors regardless of authentication state. Authenticated users receive contextual navigation ("Dashboard" link and `UserButton` in the navbar, "Go to Dashboard" in the hero CTA) and can navigate bidirectionally between `/` and their role dashboard (`/farmer`, `/business`, `/admin`). Dashboard sidebar and mobile drawer navigation now include an explicit "Marketplace Home" link and clickable brand header back to `/`. Route protection on role dashboards remains intact.
  - **Landing Page Final Visual Direction (Full-Bleed Photographic Hero):** Implemented a full-width, full-bleed photographic hero using the farmer + sunrise image (`public/hero-farmer-sunrise.jpg`) as the dominant visual foundation. Designed a directional readability scrim (`from-black/85 via-black/55 to-transparent`) leaving the farmer and sunrise on the right fully visible and vibrant while ensuring maximum contrast for white typography on the left. Retained exact headline `"Fresh from Butuan's farms to your business."`, concise supporting copy, and strictly two CTAs (`"Explore products"` and `"Sell on UMA"` / `"Go to Dashboard"`). Compacted the value strip into a subtle, non-card 4-pillar bar. Streamlined "How UMA Works" and "For Farmers / For Businesses" into open, editorial, typographic layouts free of heavy card containers and visual clutter. Preserved full public accessibility of `/` for authenticated and unauthenticated visitors.
  - **Business Dashboard Agricultural Banner:** Refined the Business Buyer dashboard welcome banner in `src/app/(dashboard)/business/page.tsx` titled `"Fresh produce from local farmers"` with supporting copy `"Source available produce and manage your wholesale orders in one place."` Built as a polished marketplace welcome card using design tokens (`bg-card`, `border-border`, `text-foreground`, `text-primary`), natural mobile stacking (visual accent header on mobile, right-aligned pane on desktop with seamless directional gradient blend), `Direct Farm Sourcing` indicator cue, and a subtle forest green `"Browse products →"` CTA linking to `/business/products` with hover microinteraction. Synchronized `src/app/(dashboard)/business/loading.tsx` suspense skeleton.

- [x] **Public Marketplace Experience (`/products` & `/products/[id]`):**
  - **Public Marketplace Catalog (`/products`):**
    - Accessible without login, matching the finalized UMA white-first, forest green editorial design.
    - Minimal public marketplace header with `Products` (active), `How it works`, `For Farmers`, and `For Businesses`. Zero messages links in public navigation.
    - Prominent search bar supporting produce keywords, varieties, and farm names.
    - Horizontal category pill bar ("All Produce" + 8 agricultural categories).
    - Sort selector ("Newest Added", "Freshest Harvest", "Price: Low to High", "Price: High to Low", "Name: A to Z") and In-stock availability filter ("In Stock Only" vs "All Availability").
    - **Real Data Discovery Sections:** "Available Now" (in-stock produce ready for order), "Fresh Picks & Recent Harvests" (recent harvest dates), "Browse by Category" (interactive category cards with descriptions), and "All Produce Listings" (complete active catalog). No fake reviews, sales numbers, or artificial scarcity.
    - Filtered search view with item counts, active query indicators, and clean filter reset.
  - **Public Product Detail View (`/products/[id]`):**
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
  - **Landing Page Integration:** Added "Products" (`/products`) to top navigation and footer; updated Hero and Final CTAs "Explore products" to route directly to `/products`.
  - **Security & Authorization:** Strict `status = 'active'` isolation across all public queries; draft products remain private; zero secret keys exposed in client bundles/browser; resilient server-side farmer provenance enrichment via server admin client.

### Public Experience UX/UI Refinement (Complete & Verified ✅)
- [x] **Product Image Sourcing & Audit:**
  - Audited demo catalog images in `scripts/seed-demo-data.ts`.
  - Replaced wrong/duplicate Unsplash URLs:
    - **Fresh Yellow Ginger (Luya):** Replaced duplicate eggplant photo (`photo-1615485290382-441e4d049cb5`) with verified ginger root harvest photo (`https://images.unsplash.com/photo-1635008388183-04ea0313c5d1?w=800&auto=format&fit=crop&q=80`).
    - **Yellow Sweet Camote:** Replaced cabbage photo (`photo-1598030343246-eec71cb44231`) with verified sweet potato pile photo (`https://images.unsplash.com/photo-1753445657069-ba23263dd733?w=800&auto=format&fit=crop&q=80`).
    - **Native Purple Ube:** Replaced 404 URL (`photo-1596097635092-6d3c8e3e4f1e`) with verified purple yam/tuber photo (`https://images.unsplash.com/photo-1730815048561-45df6f7f331d?w=800&auto=format&fit=crop&q=80`).
  - Added support for `SUPABASE_SERVICE_ROLE_KEY` fallback in seed script alongside `SUPABASE_SECRET_KEY`.
  - Executed `npm run seed:demo` live against remote Supabase: successfully downloaded and re-uploaded verified photos to Supabase Storage `product-images` bucket, and updated `products` table records with new image URLs and timestamps.
- [x] **Global CSS Utilities:**
  - Added `@utility no-scrollbar` and cross-browser `.no-scrollbar` classes (WebKit display none, Firefox/IE scrollbar-width none) in `src/app/globals.css`.
- [x] **Product Rail Components:**
  - Created `ProductRailCarousel` (`src/components/marketplace/product-rail-carousel.tsx`): Client-side carousel wrapper using shadcn Carousel primitive and Embla (`slidesToScroll: 1`, responsive basis: `basis-[85%] sm:basis-[48%] lg:basis-[25%]`, conditional desktop prev/next controls).
  - Created `FreshOnUmaRail` (`src/components/marketplace/fresh-on-uma-rail.tsx`): Server component fetching 6 in-stock products via `getActiveProducts({ inStockOnly: true, sort: "newest", limit: 6 })`, rendered with clear eyebrow ("Fresh on UMA"), headline ("What's available now"), and "Explore more produce →" link to `/products`.
- [x] **Landing Page Refactor (`src/app/page.tsx`):**
  - Integrated `<FreshOnUmaRail />` wrapped in `<Suspense>` with skeleton fallback immediately after the photographic hero.
  - Removed redundant proof/value strip to accelerate time-to-produce discovery.
  - Streamlined "How UMA Works" to 3 scannable steps (01 Discover, 02 Order, 03 Fulfill) without redundant copy.
  - Tightened Growers and Businesses sections to 3 high-impact benefit lines each with consistent primary action CTAs ("I'm a grower →" and "Explore the market →").
- [x] **Navbar Deduplication:**
  - Removed duplicate "I'm a grower" text link from right-side CTAs in `landing-navbar.tsx` and `marketplace-header.tsx`, preserving single source of truth in center navigation list (`For growers` → `/#growers`).
- [x] **Marketplace Page Polish (`src/app/products/page.tsx`):**
  - Removed redundant "Fresh Picks & Recent Harvests" section to eliminate repetitive produce grid cards.
  - Cleaned up overly formal eyebrow labels ("Structured Sourcing", "Harvest Freshness", "Ready for Ordering") in favor of a clean, scannable "In Stock" indicator.
  - Increased "Available Now" discovery grid from 4 to 6 items (`limit: 6`, 2 balanced rows on `lg:grid-cols-3`).
- [x] **Product Detail Verification (`src/app/products/[id]/page.tsx`):**
  - Verified complete preservation of wholesale procurement data, producer provenance card, MOQ enforcement, and role-aware order actions. Zero regressions.

### Visual Correction: Device Mockups & Hardware Presentation (Complete & Verified ✅)
- [x] **Refined Device Presentation to 2 Large Landscape Tablets & 1 Thick 3D Smartphone:**
  - **Marketplace Discovery Tablet (`public/showcase/desktop-marketplace.webp`, 1600x1426):**
    - Premium Space Gray aluminum tablet in landscape orientation (iPad Pro form factor). Thick physical body, precision-milled metallic edge and bezel thickness, speaker grilles, chamfered rim, and realistic rounded corners.
    - Screen displays authentic UMA `/products` wholesale discovery: search input, Butuan City location indicator, category pills, cart status, and 3 real produce cards (*Carabao Sweet Mangoes ₱130/kg*, *Native Purple Ube ₱95/kg*, *Highland Green Ampalaya ₱75/kg*) with verified grower badges.
    - Soft, multi-layered contact and ambient drop shadow diffusing smoothly to 0 opacity without harsh boundary cuts.
  - **Grower Platform Tablet (`public/showcase/desktop-grower.webp`, 1600x1426):**
    - Matching Space Gray aluminum tablet in landscape orientation, angled symmetrically opposite for visual rhythm.
    - Screen displays authentic UMA `/farmer/products` inventory management: farm profile header ("Agusan Valley Organics"), 3 operational KPI cards (Active Listings, Wholesale Orders, 100% Fulfillment Rate), live inventory table with status badges, and embedded order progression notice with direct buyer chat.
    - Unclipped soft diffuse shadow on transparent alpha channel.
  - **Mobile Experience Smartphone (`public/showcase/phone-marketplace.webp`, 800x1810):**
    - Realistic thick 3D dark titanium smartphone with physical tactile buttons, antenna bands, Dynamic Island, status bar (`9:41`), and authentic responsive mobile marketplace UI.
    - Soft contact shadow beneath with zero halo artifacts.
- [x] **Unclipped Shadows & Layout Containment:**
  - Removed restrictive `overflow-hidden` from sections 4, 5, and 6.
  - Integrated `overflow-x-clip` on root wrapper and `<main>` container to lock document horizontal scroll while allowing vertical device shadows to fully render.
- [x] **Unified Scroll Reveal Animation:**
  - Animate physical device as ONE single object (`opacity` + `translateY` + `scale` + settling `rotate`) with cubic bezier easing and full `prefers-reduced-motion` compliance.

### Launch Readiness P1 Fixes (Complete & Verified ✅)
- [x] **Stock Restitution Trigger (`20260924000002_launch_readiness_p1.sql`):**
  - PostgreSQL trigger `trg_restore_stock_on_cancelled` automatically increments `products.quantity_available` by `order_items.quantity` when an order transitions to `'cancelled'`.
  - Enforced at database level via SECURITY DEFINER trigger; runs atomically in the same transaction as order cancellation.
  - Covers both buyer self-cancellation (`cancelOrder`) and farmer rejection/cancellation (`update_order_status`).
  - Guards against double-restoration; only fires when `NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'`.
- [x] **Public Farmer Data Privacy (`queries/products.ts` & `types.ts`):**
  - Removed `phone` and sensitive contact data from public marketplace queries (`getActiveProducts`, `getProductById`).
  - Updated `Product.farmer` interface in `src/lib/types.ts` to strictly allow intentional public fields (`clerk_id, full_name, business_name, city, avatar_url, bio, is_verified`).
  - Prevents leaking private farmer phone numbers into public RSC payloads streamed to anonymous website visitors.
- [x] **Business Product Navigation Consistency (`business/products` & `business`):**
  - Updated produce cards in `/business/products` and `/business` overview to link to `/business/products/[id]`.
  - Ensures logged-in commercial buyers remain within their authenticated dashboard layout with sidebar navigation, active cart counts, and breadcrumbs.
- [x] **Transactional Multi-Farmer Checkout RPC (`place_checkout_orders`):**
  - Added atomic PostgreSQL RPC `place_checkout_orders(p_orders JSONB)` processing all farmer orders within a single transaction.
  - Validates stock, MOQ, farmer ownership, and status across all order groups before creating any order.
  - If any product fails, the entire batch rolls back atomically: 0 orders created, 0 stock deducted, and cart items remain intact.
  - Prevents partial completion and duplicate order placement on retry.

---

## 3. What Is Currently Being Worked On

- Branch `fix/launch-readiness` is complete and fully verified.
- All 4 P1 launch readiness blockers resolved and verified with automated test suites.
- Production build (20 routes compiled via Turbopack), ESLint (0 errors, 0 warnings) verified.

---

## 4. Known Issues

- **None.** Build passes cleanly (20 routes compiled via Turbopack, 0 errors), ESLint passes with 0 warnings and 0 errors, remote Supabase database trigger and RPC applied and verified.

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

## 7. Latest Verification Results (Product Media Gallery — feat/product-media-gallery)

- **Build (`npm run build`):** ✅ **PASS** (Exit code 0, 35 dynamic and static routes compiled cleanly via Turbopack)
- **Lint (`npm run lint`):** ✅ **PASS** (Exit code 0, zero warnings, zero errors across all files)
- **Database Schema & RLS:** ✅ **PASS** (`public.product_images` table created with RLS enforcing farmer ownership on insert/update/delete; public select on active products; backfill populated existing product primary images)
- **Product Gallery Carousel:** ✅ **PASS** (Built with shadcn `Carousel`, embla-carousel-react; large primary display, slide counter `1 / 3`, desktop previous/next controls, and active thumbnail ring)
- **Single & Zero-Image Fallbacks:** ✅ **PASS** (Single-image products display cleanly without redundant arrows/thumbnails; zero-image products display branded placeholder)
- **Mobile Responsiveness:** ✅ **PASS** (Touch-swipeable carousel with zero horizontal overflow `scrollWidth === clientWidth` on 390px/375px viewports)
- **Farmer Multi-Photo Uploads:** ✅ **PASS** (Farmer form supports up to 5 photos with primary badge, thumbnail previews, "Set as Primary", "Remove", and safe storage cleanup)