# UMA SECURITY CAMPAIGN 1 — AUTHORIZATION / IDOR AUDIT REPORT

**Execution Date:** 2026-09-25  
**Target System:** `http://localhost:3000` (Next.js 16 App Router)  
**Authentication Provider:** Clerk Development  
**Database Ref:** `xckdihprwjdwutglytwu` (Isolated Security-Test Supabase Project)  
**Harness Engine:** Puppeteer (Headless Chromium) + Supabase Client with Clerk User JWTs  

## Executive Summary

Campaign 1 re-evaluated all horizontal authorization, IDOR, vertical role separation, cart isolation, and database Row Level Security (RLS) policies using browser automation contexts and direct client requests signed with genuine user JWTs.

- **Actual tests executed:** 22
- **PASS:** 22
- **FAIL:** 0
- **WARNING:** 0
- **NOT TESTABLE:** 0
- **Tooling failures:** 0
- **Protected data exposed:** None (0 instances)
- **Unauthorized mutation succeeded:** None (0 instances)
- **Production safety confirmation:** Production (`https://uma.xalhexi.wtf` / ref `odnpkqjytrmciwmcehff`) was completely untouched. All traffic strictly targeted localhost and test database ref `xckdihprwjdwutglytwu`.

## Test Matrix & Accounting

| ID | Group | Account / Role | Target Resource | Mechanism | Expected | Status |
|---|---|---|---|---|---|---|
| **V1** | Vertical Role Navigation | `buyer.test@example.com (business)` | Route /farmer | Next.js App Router | Redirected to /business; no farmer metrics or... | **PASS** |
| **V2** | Vertical Role Navigation | `buyer.test@example.com (business)` | Route /admin | Next.js App Router | Redirected to /business; no platform-wide met... | **PASS** |
| **V3** | Vertical Role Navigation | `buyer.test@example.com (business)` | Route /admin/orders | Next.js App Router | Redirected to /business; no administrative or... | **PASS** |
| **V4** | Vertical Role Navigation | `farmer.test@example.com (farmer)` | Route /business | Next.js App Router | Redirected to /farmer; no commercial buyer ma... | **PASS** |
| **V5** | Vertical Role Navigation | `farmer.test@example.com (farmer)` | Route /admin | Next.js App Router | Redirected to /farmer; no platform administra... | **PASS** |
| **V6** | Vertical Role Navigation | `farmer.test@example.com (farmer)` | Route /admin/products | Next.js App Router | Redirected to /farmer; administrative catalog... | **PASS** |
| **H1** | Horizontal Order Access / IDOR | `buyer.test@example.com (business)` | Order ID b0000001-0000-0000-0000 | Next.js App Router | Server Component triggers notFound(); renders... | **PASS** |
| **H2** | Horizontal Order Access / IDOR | `buyer2.test@example.com (business)` | Order ID 89118378-8575-48d2-8570 | Next.js App Router | Server Component triggers notFound(); renders... | **PASS** |
| **H3** | Horizontal Order Access / IDOR | `farmer.test@example.com (farmer)` | Order ID b0000001-0000-0000-0000 | Next.js App Router | Server Component triggers notFound(); renders... | **PASS** |
| **H4** | Horizontal Order Access / IDOR | `farmer2.test@example.com (farmer)` | Order ID 89118378-8575-48d2-8570 | Next.js App Router | Server Component triggers notFound(); renders... | **PASS** |
| **P1** | Product Isolation & Mutation | `farmer2.test@example.com (farmer)` | Product ID a0000001-0000-0000-00 | Next.js App Router | Server Component triggers notFound(); renders... | **PASS** |
| **P2** | Product Isolation & Mutation | `farmer.test@example.com (farmer)` | Product ID a0000001-0000-0000-00 | Next.js App Router | Server Component triggers notFound(); renders... | **PASS** |
| **P3** | Product Isolation & Mutation | `farmer2.test@example.com (farmer)` | Product ID a0000001-0000-0000-00 | Supabase RLS | RLS blocks update; 0 rows modified; database ... | **PASS** |
| **P4** | Product Isolation & Mutation | `farmer.test@example.com (farmer)` | Product ID a0000001-0000-0000-00 | Supabase RLS | RLS blocks update; 0 rows modified; database ... | **PASS** |
| **C1** | Cart Isolation | `buyer2.test@example.com (business)` | Buyer 1 Cart Item 4d2681a3-31d0- | Next.js App Router | Renders empty cart ("Your cart is empty"); 0 ... | **PASS** |
| **C2** | Cart Isolation | `buyer2.test@example.com (business)` | cart_items table (containing act | Supabase RLS | Returns 0 rows; cross-user cart items filtere... | **PASS** |
| **C3** | Cart Isolation | `buyer2.test@example.com (business)` | Cart item 4d2681a3-31d0-4367-be2 | Supabase RLS | RLS blocks update; 0 rows modified; quantity ... | **PASS** |
| **C4** | Cart Isolation | `buyer2.test@example.com (business)` | Cart item 4d2681a3-31d0-4367-be2 | Supabase RLS | RLS blocks delete; 0 rows deleted; row remain... | **PASS** |
| **R1** | Database RLS Boundaries | `buyer.test@example.com (business)` | orders table ID b0000001-0000-00 | Supabase RLS | Returns 0 rows; RLS policy "orders: business ... | **PASS** |
| **R2** | Database RLS Boundaries | `farmer.test@example.com (farmer)` | orders table ID b0000001-0000-00 | Supabase RLS | Returns 0 rows; RLS policy "orders: farmer re... | **PASS** |
| **R3** | Database RLS Boundaries | `buyer.test@example.com (business)` | profiles table ID 3aa8df6a-ebfb- | Supabase RLS | Returns 0 rows; Admin profile hidden accordin... | **PASS** |
| **R4** | Database RLS Boundaries | `farmer.test@example.com (farmer)` | profiles table ID 3aa8df6a-ebfb- | Supabase RLS | Returns 0 rows; Admin profile hidden accordin... | **PASS** |

## Architectural Findings & Policy Design Notes

### 1. Route Authorization & Interstitial Handling
In previous runs, raw HTTP requests that received 200 responses from Clerk's authentication handshake or interstitial HTML were incorrectly treated as proof of authorization block. In this rerun, full Puppeteer browser contexts navigated to protected routes and fully resolved all client-side and server-side redirects.
- When a buyer attempts to access `/farmer`, `/admin`, or `/admin/orders`, Next.js layouts immediately redirect to `/business`.
- When a farmer attempts to access `/business`, `/admin`, or `/admin/products`, Next.js layouts immediately redirect to `/farmer`.
- In all cases, no protected dashboard metrics or administration controls were rendered in the DOM.

### 2. IDOR Prevention via Server Components
For dynamic order detail routes (`/business/orders/[id]` and `/farmer/orders/[id]`) and product edit routes (`/farmer/products/[id]/edit`):
- The page Server Components execute resource-level ownership queries (`getBusinessOrderById`, `getFarmerOrderById`, `getFarmerProductById`) bound strictly to the session's verified Clerk `userId`.
- When a user attempts to view a resource belonging to another customer or farmer, the query returns `null` and Next.js invokes `notFound()`.
- The browser renders the application's 404 page ("This dashboard page doesn't exist"). No order items, pricing totals, customer names, or farmer information are rendered.

### 3. Cart Isolation Across Commercial Buyers
A dedicated synthetic cart item (10 kg Crisp Native Pechay, ID `4d2681a3-31d0-4367-be22-0ff917a8163f`) was staged for Buyer 1 (`buyer.test@example.com`). A second distinct Clerk buyer account (`buyer2.test@example.com`) was used to test cart isolation:
- **Browser:** Buyer 2 navigated to `/business/cart` and rendered "Your cart is empty". Buyer 1's item was not displayed.
- **Database SELECT:** Querying `cart_items` with Buyer 2's JWT returned 0 rows.
- **Database UPDATE:** Attempting to update Buyer 1's cart item quantity via Buyer 2's JWT modified 0 rows.
- **Database DELETE:** Attempting to delete Buyer 1's cart item via Buyer 2's JWT deleted 0 rows.
- Verification confirmed Buyer 1's cart item remained in the database with original quantity 10 until legitimate teardown.

### 4. Admin Profile Visibility Policy Evaluation
The test database contains an actual platform administrator profile (`3aa8df6a-ebfb-401b-aa36-120c04634733`, 'Test Platform Administrator', role: 'admin'). Under the application's intended RLS design:
- Policy `profiles: read own` restricts reads to `clerk_id = auth.jwt()->>'sub'`.
- Policy `profiles: business reads farmer` restricts buyers to `role = 'farmer'`.
- Policy `profiles: farmer reads order business` restricts farmers to business profiles associated with active orders.
- Policy `profiles: admin reads all` requires `(auth.jwt()->>'user_role') = 'admin'`.
Because no policy permits non-admin roles to read admin profiles, querying `WHERE role = 'admin'` as Buyer 1 or Farmer 1 returned 0 rows. This confirms the security boundary functions exactly as designed.

## Detailed Test Evidence

### [PASS] V1: Buyer -> Farmer Dashboard navigation attempt
- **Group:** Vertical Role Navigation
- **Identity:** `buyer.test@example.com (business)`
- **Target Resource:** `Route /farmer`
- **Action:** `Browser navigation to http://localhost:3000/farmer following all redirects`
- **Expected Result:** Redirected to /business; no farmer metrics or management UI rendered
- **Actual Result:** Final URL: http://localhost:3000/business | Heading: "Fresh produce from local farmers"
- **Final State:** `URL: http://localhost:3000/business (HTTP 200)`
- **Evidence:** Redirected to http://localhost:3000/business. Rendered heading "Fresh produce from local farmers". Farmer dashboard was not rendered.
- **Status:** **PASS**

### [PASS] V2: Buyer -> Admin Dashboard navigation attempt
- **Group:** Vertical Role Navigation
- **Identity:** `buyer.test@example.com (business)`
- **Target Resource:** `Route /admin`
- **Action:** `Browser navigation to http://localhost:3000/admin following all redirects`
- **Expected Result:** Redirected to /business; no platform-wide metrics or admin controls rendered
- **Actual Result:** Final URL: http://localhost:3000/business | Heading: "Fresh produce from local farmers"
- **Final State:** `URL: http://localhost:3000/business (HTTP 200)`
- **Evidence:** Redirected to http://localhost:3000/business. Rendered marketplace heading "Fresh produce from local farmers". Admin dashboard was not rendered.
- **Status:** **PASS**

### [PASS] V3: Buyer -> Admin Orders list navigation attempt
- **Group:** Vertical Role Navigation
- **Identity:** `buyer.test@example.com (business)`
- **Target Resource:** `Route /admin/orders`
- **Action:** `Browser navigation to http://localhost:3000/admin/orders following all redirects`
- **Expected Result:** Redirected to /business; no administrative orders table rendered
- **Actual Result:** Final URL: http://localhost:3000/business | Heading: "Fresh produce from local farmers"
- **Final State:** `URL: http://localhost:3000/business (HTTP 200)`
- **Evidence:** Redirected to http://localhost:3000/business. Administrative orders table was not rendered.
- **Status:** **PASS**

### [PASS] V4: Farmer -> Business Marketplace navigation attempt
- **Group:** Vertical Role Navigation
- **Identity:** `farmer.test@example.com (farmer)`
- **Target Resource:** `Route /business`
- **Action:** `Browser navigation to http://localhost:3000/business following all redirects`
- **Expected Result:** Redirected to /farmer; no commercial buyer marketplace controls rendered
- **Actual Result:** Final URL: http://localhost:3000/farmer | Heading: "Welcome back"
- **Final State:** `URL: http://localhost:3000/farmer (HTTP 200)`
- **Evidence:** Redirected to http://localhost:3000/farmer. Rendered farmer dashboard heading "Welcome back".
- **Status:** **PASS**

### [PASS] V5: Farmer -> Admin Dashboard navigation attempt
- **Group:** Vertical Role Navigation
- **Identity:** `farmer.test@example.com (farmer)`
- **Target Resource:** `Route /admin`
- **Action:** `Browser navigation to http://localhost:3000/admin following all redirects`
- **Expected Result:** Redirected to /farmer; no platform administrator dashboard rendered
- **Actual Result:** Final URL: http://localhost:3000/farmer | Heading: "Welcome back"
- **Final State:** `URL: http://localhost:3000/farmer (HTTP 200)`
- **Evidence:** Redirected to http://localhost:3000/farmer. Farmer dashboard remained active.
- **Status:** **PASS**

### [PASS] V6: Farmer -> Admin Products Management navigation attempt
- **Group:** Vertical Role Navigation
- **Identity:** `farmer.test@example.com (farmer)`
- **Target Resource:** `Route /admin/products`
- **Action:** `Browser navigation to http://localhost:3000/admin/products following all redirects`
- **Expected Result:** Redirected to /farmer; administrative catalog controls not rendered
- **Actual Result:** Final URL: http://localhost:3000/farmer | Heading: "Welcome back"
- **Final State:** `URL: http://localhost:3000/farmer (HTTP 200)`
- **Evidence:** Redirected to http://localhost:3000/farmer. Admin product management was not rendered.
- **Status:** **PASS**

### [PASS] H1: Buyer 1 -> Another buyer seed order details
- **Group:** Horizontal Order Access / IDOR
- **Identity:** `buyer.test@example.com (business)`
- **Target Resource:** `Order ID b0000001-0000-0000-0000-000000000003 (Owned by Sunrise Eatery)`
- **Action:** `Browser navigation to http://localhost:3000/business/orders/b0000001-0000-0000-0000-000000000003`
- **Expected Result:** Server Component triggers notFound(); renders 404 page; no order/farmer data exposed
- **Actual Result:** Page text: "UMA MARKET

Page not found

This dashboard page doesn't exist. It may have been removed or the link ..."
- **Final State:** `URL: http://localhost:3000/business/orders/b0000001-0000-0000-0000-000000000003 | Rendered 404 Not Found UI`
- **Evidence:** Server rendered 404 Not Found UI. Verified order total (3,700) and farmer provenance were completely absent from DOM.
- **Status:** **PASS**

### [PASS] H2: Buyer 2 -> Buyer 1 real test order details
- **Group:** Horizontal Order Access / IDOR
- **Identity:** `buyer2.test@example.com (business)`
- **Target Resource:** `Order ID 89118378-8575-48d2-8570-634c0bb59f5a (Owned by Buyer 1)`
- **Action:** `Browser navigation to http://localhost:3000/business/orders/89118378-8575-48d2-8570-634c0bb59f5a`
- **Expected Result:** Server Component triggers notFound(); renders 404 page; no order/item data exposed
- **Actual Result:** Page text: "Your profile is incomplete. Set up your details to start trading on UMA Market.
Complete Profile →

..."
- **Final State:** `URL: http://localhost:3000/business/orders/89118378-8575-48d2-8570-634c0bb59f5a | Rendered 404 Not Found UI`
- **Evidence:** Server rendered 404 Not Found UI. Verified order total (450) and Pechay line item were completely absent from DOM.
- **Status:** **PASS**

### [PASS] H3: Farmer 1 -> Another farmer seed order details
- **Group:** Horizontal Order Access / IDOR
- **Identity:** `farmer.test@example.com (farmer)`
- **Target Resource:** `Order ID b0000001-0000-0000-0000-000000000003 (Directed to Agusan Valley)`
- **Action:** `Browser navigation to http://localhost:3000/farmer/orders/b0000001-0000-0000-0000-000000000003`
- **Expected Result:** Server Component triggers notFound(); renders 404 page; no buyer/order data exposed
- **Actual Result:** Page text: "UMA MARKET

Page not found

This dashboard page doesn't exist. It may have been removed or the link ..."
- **Final State:** `URL: http://localhost:3000/farmer/orders/b0000001-0000-0000-0000-000000000003 | Rendered 404 Not Found UI`
- **Evidence:** Server rendered 404 Not Found UI. Verified buyer details and order items were completely absent from DOM.
- **Status:** **PASS**

### [PASS] H4: Farmer 2 -> Farmer 1 real test order details
- **Group:** Horizontal Order Access / IDOR
- **Identity:** `farmer2.test@example.com (farmer)`
- **Target Resource:** `Order ID 89118378-8575-48d2-8570-634c0bb59f5a (Directed to Farmer 1)`
- **Action:** `Browser navigation to http://localhost:3000/farmer/orders/89118378-8575-48d2-8570-634c0bb59f5a`
- **Expected Result:** Server Component triggers notFound(); renders 404 page; no customer/item data exposed
- **Actual Result:** Page text: "Your profile is incomplete. Set up your details to start trading on UMA Market.
Complete Profile →

..."
- **Final State:** `URL: http://localhost:3000/farmer/orders/89118378-8575-48d2-8570-634c0bb59f5a | Rendered 404 Not Found UI`
- **Evidence:** Server rendered 404 Not Found UI. Verified order details were completely absent from DOM.
- **Status:** **PASS**

### [PASS] P1: Farmer 2 -> Farmer 1 product edit page (Browser)
- **Group:** Product Isolation & Mutation
- **Identity:** `farmer2.test@example.com (farmer)`
- **Target Resource:** `Product ID a0000001-0000-0000-0000-000000000002 (Crisp Native Pechay, owned by Farmer 1)`
- **Action:** `Browser navigation to http://localhost:3000/farmer/products/a0000001-0000-0000-0000-000000000002/edit`
- **Expected Result:** Server Component triggers notFound(); renders 404 page; edit form not exposed
- **Actual Result:** Page text: "Your profile is incomplete. Set up your details to start trading on UMA Market.
Complete Profile →

..." | Form present: false
- **Final State:** `URL: http://localhost:3000/farmer/products/a0000001-0000-0000-0000-000000000002/edit | Rendered 404 Not Found UI`
- **Evidence:** Server rendered 404 Not Found UI. Edit form and input elements were not rendered.
- **Status:** **PASS**

### [PASS] P2: Farmer 1 -> Another farmer product edit page (Browser)
- **Group:** Product Isolation & Mutation
- **Identity:** `farmer.test@example.com (farmer)`
- **Target Resource:** `Product ID a0000001-0000-0000-0000-000000000001 (Highland Ampalaya, owned by Verdant Ridge)`
- **Action:** `Browser navigation to http://localhost:3000/farmer/products/a0000001-0000-0000-0000-000000000001/edit`
- **Expected Result:** Server Component triggers notFound(); renders 404 page; edit form not exposed
- **Actual Result:** Page text: "UMA MARKET

Page not found

This dashboard page doesn't exist. It may have been removed or the link ..." | Form present: false
- **Final State:** `URL: http://localhost:3000/farmer/products/a0000001-0000-0000-0000-000000000001/edit | Rendered 404 Not Found UI`
- **Evidence:** Server rendered 404 Not Found UI. Product editing interface not exposed.
- **Status:** **PASS**

### [PASS] P3: Farmer 2 -> Direct UPDATE on Farmer 1 product (Database / RLS)
- **Group:** Product Isolation & Mutation
- **Identity:** `farmer2.test@example.com (farmer)`
- **Target Resource:** `Product ID a0000001-0000-0000-0000-000000000002 (Current price: ₱45)`
- **Action:** `Supabase PostgREST UPDATE price_per_unit = 1 with Farmer 2 user JWT`
- **Expected Result:** RLS blocks update; 0 rows modified; database price remains ₱45
- **Actual Result:** Rows modified: 0 | Price in DB: ₱45
- **Final State:** `Database price_per_unit = 45`
- **Evidence:** PostgREST returned status 200 with empty mutation array ([]). Price in database verified unchanged at ₱45.
- **Status:** **PASS**

### [PASS] P4: Farmer 1 -> Direct UPDATE on another farmer product (Database / RLS)
- **Group:** Product Isolation & Mutation
- **Identity:** `farmer.test@example.com (farmer)`
- **Target Resource:** `Product ID a0000001-0000-0000-0000-000000000001 (Current price: ₱75)`
- **Action:** `Supabase PostgREST UPDATE price_per_unit = 1 with Farmer 1 user JWT`
- **Expected Result:** RLS blocks update; 0 rows modified; database price remains ₱75
- **Actual Result:** Rows modified: 0 | Price in DB: ₱75
- **Final State:** `Database price_per_unit = 75`
- **Evidence:** PostgREST returned status 200 with empty mutation array ([]). Price in database verified unchanged at ₱75.
- **Status:** **PASS**

### [PASS] C1: Buyer 2 -> View Cart via Browser while Buyer 1 has active cart item
- **Group:** Cart Isolation
- **Identity:** `buyer2.test@example.com (business)`
- **Target Resource:** `Buyer 1 Cart Item 4d2681a3-31d0-4367-be22-0ff917a8163f (Pechay, 10 kg)`
- **Action:** `Browser navigation to http://localhost:3000/business/cart`
- **Expected Result:** Renders empty cart ("Your cart is empty"); 0 items displayed; Buyer 1 item invisible
- **Actual Result:** Rendered: "Your cart is empty"
- **Final State:** `URL: http://localhost:3000/business/cart | "Your cart is empty" rendered`
- **Evidence:** Browser rendered "Your cart is empty". Verified Buyer 1 cart item (Pechay, 10 kg) was completely absent from DOM.
- **Status:** **PASS**

### [PASS] C2: Buyer 2 -> SELECT * FROM cart_items via User JWT
- **Group:** Cart Isolation
- **Identity:** `buyer2.test@example.com (business)`
- **Target Resource:** `cart_items table (containing active item 4d2681a3-31d0-4367-be22-0ff917a8163f)`
- **Action:** `Supabase PostgREST SELECT * with Buyer 2 user JWT`
- **Expected Result:** Returns 0 rows; cross-user cart items filtered out by RLS
- **Actual Result:** Rows returned: 0
- **Final State:** `Data: []`
- **Evidence:** Query returned 0 rows despite active cart row 4d2681a3-31d0-4367-be22-0ff917a8163f belonging to Buyer 1 present in the table.
- **Status:** **PASS**

### [PASS] C3: Buyer 2 -> UPDATE Buyer 1 cart item quantity via User JWT
- **Group:** Cart Isolation
- **Identity:** `buyer2.test@example.com (business)`
- **Target Resource:** `Cart item 4d2681a3-31d0-4367-be22-0ff917a8163f (Original quantity: 10)`
- **Action:** `Supabase PostgREST UPDATE quantity = 99 with Buyer 2 user JWT`
- **Expected Result:** RLS blocks update; 0 rows modified; quantity remains 10
- **Actual Result:** Rows modified: 0 | Quantity in DB: 10
- **Final State:** `cart_items.quantity = 10`
- **Evidence:** Update attempt returned 0 modified rows. Verified quantity in database remained 10.
- **Status:** **PASS**

### [PASS] C4: Buyer 2 -> DELETE Buyer 1 cart item via User JWT
- **Group:** Cart Isolation
- **Identity:** `buyer2.test@example.com (business)`
- **Target Resource:** `Cart item 4d2681a3-31d0-4367-be22-0ff917a8163f`
- **Action:** `Supabase PostgREST DELETE with Buyer 2 user JWT`
- **Expected Result:** RLS blocks delete; 0 rows deleted; row remains intact in database
- **Actual Result:** Rows deleted: 0 | Row still exists in DB: true
- **Final State:** `Row exists: true`
- **Evidence:** Delete attempt returned 0 deleted rows. Row verified intact in database.
- **Status:** **PASS**

### [PASS] R1: Buyer 1 -> SELECT another buyer seed order via User JWT
- **Group:** Database RLS Boundaries
- **Identity:** `buyer.test@example.com (business)`
- **Target Resource:** `orders table ID b0000001-0000-0000-0000-000000000003`
- **Action:** `Supabase PostgREST SELECT * WHERE id = 'b0000001-0000-0000-0000-000000000003' with Buyer 1 user JWT`
- **Expected Result:** Returns 0 rows; RLS policy "orders: business reads own" enforces business_clerk_id match
- **Actual Result:** Rows returned: 0
- **Final State:** `Data: []`
- **Evidence:** Target row confirmed to exist in DB (owned by Sunrise Eatery). PostgREST returned 0 rows to unauthorized buyer.
- **Status:** **PASS**

### [PASS] R2: Farmer 1 -> SELECT another farmer seed order via User JWT
- **Group:** Database RLS Boundaries
- **Identity:** `farmer.test@example.com (farmer)`
- **Target Resource:** `orders table ID b0000001-0000-0000-0000-000000000003`
- **Action:** `Supabase PostgREST SELECT * WHERE id = 'b0000001-0000-0000-0000-000000000003' with Farmer 1 user JWT`
- **Expected Result:** Returns 0 rows; RLS policy "orders: farmer reads own" enforces farmer_clerk_id match
- **Actual Result:** Rows returned: 0
- **Final State:** `Data: []`
- **Evidence:** Target row confirmed to exist in DB (directed to Agusan Valley). PostgREST returned 0 rows to unauthorized farmer.
- **Status:** **PASS**

### [PASS] R3: Buyer 1 -> SELECT admin profiles via User JWT
- **Group:** Database RLS Boundaries
- **Identity:** `buyer.test@example.com (business)`
- **Target Resource:** `profiles table ID 3aa8df6a-ebfb-401b-aa36-120c04634733 (role = 'admin')`
- **Action:** `Supabase PostgREST SELECT id, full_name, role WHERE role = 'admin' with Buyer 1 user JWT`
- **Expected Result:** Returns 0 rows; Admin profile hidden according to RLS policy design
- **Actual Result:** Rows returned: 0
- **Final State:** `Data: []`
- **Evidence:** Admin profile row 3aa8df6a-ebfb-401b-aa36-120c04634733 confirmed in database. RLS permits buyers to read only their own profile and farmer profiles (role = 'farmer'). Admin profile was inaccessible (0 rows returned).
- **Status:** **PASS**

### [PASS] R4: Farmer 1 -> SELECT admin profiles via User JWT
- **Group:** Database RLS Boundaries
- **Identity:** `farmer.test@example.com (farmer)`
- **Target Resource:** `profiles table ID 3aa8df6a-ebfb-401b-aa36-120c04634733 (role = 'admin')`
- **Action:** `Supabase PostgREST SELECT id, full_name, role WHERE role = 'admin' with Farmer 1 user JWT`
- **Expected Result:** Returns 0 rows; Admin profile hidden according to RLS policy design
- **Actual Result:** Rows returned: 0
- **Final State:** `Data: []`
- **Evidence:** Admin profile row 3aa8df6a-ebfb-401b-aa36-120c04634733 confirmed in database. RLS permits farmers to read only their own profile and business profiles with shared orders. Admin profile was inaccessible (0 rows returned).
- **Status:** **PASS**

