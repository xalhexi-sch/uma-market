# UMA Market — Security Test Environment Setup Guide

**Document Version:** 1.0.0  
**Target:** Dedicated & Fully Isolated Security-Test Environment  
**Git Branch:** `audit/security-resilience`  
**Production URL:** [https://uma.xalhexi.wtf](https://uma.xalhexi.wtf) (Must remain untouched)  

---

## 1. Target Architecture & Environment Boundary

To guarantee that penetration tests, concurrency race hammers, and load tests never impact production, the security testing environment must be logically isolated from production.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION ENVIRONMENT                          │
│                                                                        │
│   Production Web Client (https://uma.xalhexi.wtf)                      │
│        │                                                               │
│        ├──► Clerk Production Instance (pk_live_...)                    │
│        │                                                               │
│        └──► Production Supabase Project (Ref: odnpkqjytrmciwmcehff)    │
│             ├── Real Pilot Farmer & Buyer Profiles                     │
│             ├── Live Commercial Produce Inventory                      │
│             └── Authentic Order History & Audit Trails                 │
└────────────────────────────────────────────────────────────────────────┘

                   || LOGICAL ISOLATION BOUNDARY ||

┌────────────────────────────────────────────────────────────────────────┐
│                    SECURITY-TEST ENVIRONMENT                           │
│                                                                        │
│   Local / Test Runner (http://localhost:3000 or port 3001)             │
│        │                                                               │
│        ├──► Clerk Development Instance (pk_test_...)                   │
│        │    (Issuer: thankful-terrapin-2971.clerk.accounts.dev)        │
│        │                                                               │
│        └──► DEDICATED Security-Test Supabase Project                   │
│             (Ref: <NEW-SECURITY-TEST-REF>)                             │
│             ├── All Migrations Applied (000001 → 000004)               │
│             ├── Purely Synthetic Demo Catalog                          │
│             ├── Purely Synthetic Orders & Balances                     │
│             └── ZERO Real Pilot Records                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Step-by-Step Provisioning: New Supabase Security-Test Project

### Step 2.1: Create Project in Supabase Dashboard
1. Log in to [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Click **"New Project"**.
3. Select your organization.
4. Set **Project Name:** `uma-market-security-test`.
5. Set a strong **Database Password** (store securely in a password manager).
6. Set **Region:** `Southeast Asia (Singapore)` (matching production latency).
7. Choose the **Free** tier (or Pro if concurrency testing requires higher pool limits).
8. Click **"Create new project"** and wait ~2 minutes for provisioning to finish.

### Step 2.2: Collect Project API Credentials
In the new project, navigate to **Project Settings** → **API**:
1. Copy **Project URL** (Format: `https://<new-test-ref>.supabase.co`).
2. Copy **Project API Keys** → `anon` `public` key (Publishable key).
3. Copy **Project API Keys** → `service_role` `secret` key (Secret key).

> [!CAUTION]
> Ensure the Project URL does **NOT** equal `https://odnpkqjytrmciwmcehff.supabase.co` (which is the live production database).

---

## 3. Clerk Development Integration (Third-Party Auth)

UMA Market uses Clerk session tokens as Supabase access tokens via `auth.jwt()`. To allow Clerk Development users (`buyer.test@example.com`, `farmer.test@example.com`, `admin.test@example.com`) to authenticate with the new Supabase project:

### Step 3.1: Configure Supabase Third-Party Auth
1. In the new Supabase project dashboard, navigate to **Project Settings** → **Authentication**.
2. Scroll to **Third-Party Auth** (or **JWT Settings** depending on Supabase UI version).
3. Add a new **Custom JWT / Third-Party Provider** or configure Clerk:
   * **Issuer (Domain):**
     ```text
     https://thankful-terrapin-2971.clerk.accounts.dev
     ```
   * **JWKS URL:**
     ```text
     https://thankful-terrapin-2971.clerk.accounts.dev/.well-known/jwks.json
     ```
4. Save the configuration.

### Step 3.2: Verify Session Token Claims
The existing Clerk Development instance already mints the `user_role` claim in session tokens:
```json
{
  "user_role": "{{user.public_metadata.role}}"
}
```
Because the new Supabase project now validates against the Clerk Development JWKS endpoint, all calls to `auth.jwt()->>'sub'` and `auth.jwt()->>'user_role'` in PostgreSQL RLS policies and RPCs will function identically to production.

---

## 4. Next.js Environment Configuration & Isolation Guard

### 4.1 Next.js Environment Loading Rules
Next.js loads environment files in the following order of precedence:
1. `process.env` (system environment)
2. `.env.development.local` (during `next dev`)
3. `.env.local` (always loaded by `next dev` and `next start`)
4. `.env.development` (during `next dev`)
5. `.env`

> [!WARNING]
> Next.js **does NOT automatically load `.env.test.local`** during `next dev`.  
> `next dev` enforces `NODE_ENV=development`. If your `.env.local` contains production database credentials, running `npm run dev` will connect directly to production!

### 4.2 Safe Environment Separation Procedure
To eliminate accidental cross-connection, we maintain two distinct local configurations:

1. **Backup Existing Configuration:**
   Rename the current production-connected `.env.local`:
   ```bash
   cp .env.local .env.production.backup
   ```

2. **Populate `.env.local` for Security Testing:**
   Update `.env.local` with the new test project credentials:
   ```env
   # Clerk Development (Reused)
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
   NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...

   # DEDICATED Security-Test Supabase Project
   NEXT_PUBLIC_SUPABASE_URL=https://<new-test-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...

   # Clerk Webhook Signing Secret (Development instance)
   CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
   ```

3. **Pre-flight Assertion Script:**
   Verify that `.env.local` does not point to production before starting any test command.

---

## 5. Migration Deployment to Test Database

Apply all 8 project migrations in chronological sequence to the new security-test database:

| # | Migration File | Core Objects Deployed |
| :-: | :--- | :--- |
| **1** | `supabase/migrations/20260922000001_initial_schema.sql` | `profiles`, `products`, `orders`, `order_items`, `cart_items`, `messages`, `categories`, RLS policies. |
| **2** | `supabase/migrations/20260922000002_slice2_schema.sql` | `place_order` RPC, `update_order_status` RPC. |
| **3** | `supabase/migrations/20260923000001_slice4_storage.sql` | Storage RLS policies for `product-images` bucket. |
| **4** | `supabase/migrations/20260923000002_public_marketplace_profiles.sql` | `public_farmer_profiles` view & permissions. |
| **5** | `supabase/migrations/20260924000001_product_media_gallery.sql` | `product_images` gallery table & indexes. |
| **6** | `supabase/migrations/20260924000002_launch_readiness_p1.sql` | Constraints, indexes, data integrity rules. |
| **7** | `supabase/migrations/20260924000003_security_hardening_p1.sql` | Terminal status trigger (`trg_enforce_order_terminal_status`), safe stock restitution trigger (`trg_restore_stock_on_cancelled`). |
| **8** | `supabase/migrations/20260924000004_security_concurrency_hardening.sql` | Profile protection trigger (`trg_protect_profile_fields`), `FOR UPDATE` row locking in `place_checkout_orders` and `update_order_status`. |

### Deployment Option A: Using Supabase CLI (Recommended)
1. Link to the new test project:
   ```bash
   npx supabase link --project-ref <new-test-ref>
   ```
2. Push all migrations:
   ```bash
   npx supabase db push
   ```

### Deployment Option B: Supabase Dashboard SQL Editor
If the CLI is not linked, open the new project's **SQL Editor** and execute the contents of files `20260922000001` through `20260924000004` sequentially.

### Storage Bucket Creation
1. Go to **Storage** in the new Supabase dashboard.
2. Click **"New Bucket"**.
3. Name: `product-images`.
4. Set **Public Bucket:** `ON` (Public read enabled).
5. Click **"Save"**. (The RLS policies from migration `20260923000001` govern uploads and deletes).

---

## 6. Synthetic Seed Procedure

Once migrations are applied, seed the database with synthetic data:

1. Ensure `.env.local` contains the test project credentials.
2. Run the seed script:
   ```bash
   npm run seed:demo
   ```
3. **Verify Output:**
   * 8 categories seeded
   * 4 synthetic farmers created (`demo_farmer_*`)
   * 2 synthetic buyers created (`demo_buyer_*`)
   * 20 synthetic produce listings created
   * 4 sample historical orders created

### 6.2 Test User Profile Provisioning

The new Supabase security-test database will **NOT** contain the production profile rows. To enable testing with the three existing Clerk Development test accounts:
* `buyer.test@example.com` (role: `business`)
* `farmer.test@example.com` (role: `farmer`)
* `admin.test@example.com` (role: `admin`)

Corresponding synthetic profile rows must be provisioned in the security-test database:
1. **Verify Clerk User IDs First:** Retrieve and verify the real Clerk user IDs (`user_...`) for these three accounts from the Clerk Development Dashboard (or via Clerk CLI / API) before inserting rows. Do not guess or assume IDs.
2. **Synthetic Profiles Only:** Only these verified test profiles are provisioned.
3. **Exact Schema Fields Required for `public.profiles`:**
   * `clerk_id` (TEXT NOT NULL UNIQUE, the verified Clerk user ID)
   * `role` (TEXT NOT NULL, checked against `'farmer'`, `'business'`, `'admin'`)
   * `full_name` (TEXT, synthetic test name e.g. "Test Business Buyer")
   * `business_name` (TEXT, synthetic business name e.g. "Balanghai Test Bistro")
   * `phone` (TEXT, synthetic phone number)
   * `address` (TEXT, synthetic address)
   * `city` (TEXT NOT NULL DEFAULT `'Butuan'`)
   * `bio` (TEXT, synthetic bio)
   * `avatar_url` (TEXT, optional placeholder or null)
   * `is_verified` (BOOLEAN NOT NULL DEFAULT `FALSE`, set `TRUE` for verified test farmer)
4. **SQL Generation Rule:** Gemini must generate the exact SQL insertion statements from the active database schema after the user verifies and provides the real Clerk IDs for the three test accounts. Do not guess or invent SQL beforehand.

---

## 7. Isolation Verification Procedure (5 Proofs)

Before executing any security or load tests, execute this 5-point verification checklist:

### Proof 1: Project URL Verification
Inspect the running server configuration:
```bash
node --env-file=.env.local -e "console.log('Target DB URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)"
```
* **PASS Criteria:** Output matches `https://<new-test-ref>.supabase.co`.
* **FAIL Criteria:** Output matches `https://odnpkqjytrmciwmcehff.supabase.co` (HALT IMMEDIATELY).

### Proof 2: Order Creation Isolation
1. Query total order count in **Production**:
   ```sql
   SELECT count(*) FROM public.orders; -- Note: N_prod
   ```
2. Place a test order on localhost (`http://localhost:3000/business/checkout`).
3. Query order count in **Test Database**:
   ```sql
   SELECT count(*) FROM public.orders; -- Must increment by 1
   ```
4. Query total order count in **Production**:
   ```sql
   SELECT count(*) FROM public.orders; -- Must strictly equal N_prod (unaltered)
   ```

### Proof 3: Clerk Development JWT Acceptance
1. Sign in to localhost as `buyer.test@example.com`.
2. Navigate to `/business/products`.
3. Open browser DevTools Network tab and verify requests to `https://<new-test-ref>.supabase.co/rest/v1/*` return HTTP `200 OK` (not `401 Unauthorized`).

### Proof 4: Inventory Restitution Isolation
1. On localhost, place an order for 2 kg of tomatoes.
2. Observe test product `quantity_available` decrements.
3. Query production tomato inventory: confirm production stock remains unchanged.

### Proof 5: Storage Upload Isolation
1. Upload a product image on localhost as a farmer.
2. Confirm the uploaded file exists in the test project's `product-images` bucket.
3. Confirm zero files were added to the production storage bucket.

---

## 8. Test Teardown & Reset Procedure

After completing a destructive concurrency or mutation test cycle, reset the test database:

```sql
-- scripts/reset-test-database.sql
-- TRUNCATE test transaction tables
TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.cart_items CASCADE;
TRUNCATE TABLE public.order_items CASCADE;
TRUNCATE TABLE public.orders CASCADE;
```

Then re-run the seed script to restore product inventories to clean baseline values:
```bash
npm run seed:demo
```

---

## 9. Production Safety Rules Summary

1. **PROD LOCK:** The project reference `odnpkqjytrmciwmcehff` is the live production database. Any command, script, or configuration pointing to it during security testing is strictly forbidden.
2. **DATA ISOLATION RULE:** Never copy the production profiles, orders, messages, or inventory tables into the security-test database. The security-test environment must contain synthetic data only.
3. **ZERO SECRET COMMITS:** Never commit `.env.local`, `.env.production.backup`, or any file containing `sb_secret_` or `sk_live_` to git.
4. **ISOLATED TEST PORTS:** Run the security testing application on a distinct port (e.g. `npm run dev -- -p 3001`) if necessary to prevent browser session contamination with production tabs.
5. **READ-ONLY PROD PROBES:** Any query to production during isolation verification must be strictly read-only (`SELECT count(*)...`) to verify non-interference. Zero write, load, or attack traffic may ever touch production.
