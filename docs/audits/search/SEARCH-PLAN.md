# UMA Market — Feature A: Smart Search & Discovery Implementation Plan

**Feature Code:** Roadmap Item A — Smart Search & Discovery  
**Author:** AI Engineering & Architecture  
**Date:** 2026-09-25  
**Status:** Approved for Implementation Planning (READ-ONLY / NO CODE CHANGES YET)  
**Target Environment:** Local / Dedicated UMA Test Supabase (`xckdihprwjdwutglytwu`)

---

## 1. Executive Summary & Audit Baseline

### Current State Baseline
The read-only audit of product search in UMA Market identified the following characteristics and limitations:
1. **Name-Only Matching:** Product search currently executes `query.ilike("name", `%${search}%`)` against `public.products.name` in `src/lib/supabase/queries/products.ts`.
2. **Zero Typo Tolerance:** Searching for "Tomatp" returns 0 products, even when "Ampayon Fresh Red Tomatoes" is actively stocked.
3. **No Stemming or Plural Support:** Queries like "Tomatoes" vs "Tomato" or "Bananas" vs "Banana" rely strictly on substring containment; variations fail if phrasing differs.
4. **Local Dialect & Common Misspellings Fail:** In the Caraga / Butuan agricultural context, variations like "petchay" vs "pechay", "talongg" vs "talong", or "camote" vs "kamote" must be resiliently handled.
5. **No Farmer or Category Search:** Searching for a known cooperative or producer (e.g. "Verdant Ridge", "Golden Harvest") or category (e.g. "Vegetables", "Root Crops") yields 0 products unless the producer or category name happens to appear inside `products.name`.
6. **In-Memory Category Post-Filtering Bug:** Currently, `src/lib/supabase/queries/products.ts` fetches a page of products via PostgREST and filters by `categorySlug` in JavaScript memory *after* slicing pagination ranges (`products = products.filter((p) => p.category?.slug === categorySlug)`). If 24 products are retrieved and only 2 match the category, the user sees only 2 items on page 1, breaking pagination controls and total item counts.
7. **Missing Search Indexes:** The `products` table has indexes on `farmer_clerk_id`, `status`, and `category_id`, but lacks full-text or trigram indexes on `name` or `description`.

### Solution Architecture
Implement a PostgreSQL-native **Trigram Search Engine** powered by the official `pg_trgm` extension and an authoritative `public.search_products` PostgreSQL RPC. This approach:
- Eliminates external dependencies (no Algolia, Meilisearch, or Elasticsearch required).
- Provides robust typo tolerance and fuzzy substring matching across English, Tagalog, and Cebuano agricultural terminology.
- Integrates multi-field weighted scoring (`products.name` > `categories.name` > `profiles.business_name`/`full_name` > `products.description`).
- Performs server-side category, in-stock, and status filtering *inside the database query* before pagination.
- Returns accurate windowed `total_count` and relevance ranking `search_rank` in a single round-trip.
- Preserves 100% of existing URL parameter behavior (`?q=...&category=...&sort=...&in_stock=...`), Next.js RSC streaming, and security RLS guarantees.

---

## 2. Detailed Technical Plan

### A. Database Layer

#### 1. PostgreSQL Extensions
Enable `pg_trgm` in the `extensions` schema:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
```

#### 2. Specialized Database Indexes
To maintain sub-15ms query execution on catalog searches as listings scale:
```sql
-- GIN Trigram index on produce name (primary search target)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
  ON public.products USING gin (name extensions.gin_trgm_ops);

-- GIN Trigram index on produce description (supporting keyword target)
CREATE INDEX IF NOT EXISTS idx_products_description_trgm 
  ON public.products USING gin (description extensions.gin_trgm_ops);

-- GIN Trigram index on category names
CREATE INDEX IF NOT EXISTS idx_categories_name_trgm 
  ON public.categories USING gin (name extensions.gin_trgm_ops);

-- GIN Trigram index on farmer business name (producer discovery)
CREATE INDEX IF NOT EXISTS idx_profiles_farmer_biz_trgm 
  ON public.profiles USING gin (business_name extensions.gin_trgm_ops) 
  WHERE role = 'farmer';

-- GIN Trigram index on farmer full name
CREATE INDEX IF NOT EXISTS idx_profiles_farmer_name_trgm 
  ON public.profiles USING gin (full_name extensions.gin_trgm_ops) 
  WHERE role = 'farmer';

-- Composite B-Tree index for active produce status, category, and inventory filtering
CREATE INDEX IF NOT EXISTS idx_products_active_category_stock 
  ON public.products (status, category_id, quantity_available);
```

#### 3. Search RPC / Function Design: `public.search_products`
The RPC will be created with `SECURITY DEFINER` and `SET search_path = public, extensions, pg_temp;`.

```sql
CREATE OR REPLACE FUNCTION public.search_products(
  p_search TEXT DEFAULT NULL,
  p_category_slug TEXT DEFAULT NULL,
  p_in_stock_only BOOLEAN DEFAULT TRUE,
  p_sort TEXT DEFAULT 'relevance',
  p_limit INT DEFAULT 24,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  farmer_clerk_id TEXT,
  category_id UUID,
  name TEXT,
  description TEXT,
  price_per_unit NUMERIC(10,2),
  unit TEXT,
  quantity_available NUMERIC(10,2),
  min_order_quantity NUMERIC(10,2),
  image_url TEXT,
  image_path TEXT,
  harvest_date DATE,
  available_until DATE,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  category JSONB,
  farmer JSONB,
  images JSONB,
  search_rank REAL,
  total_count BIGINT
)
```

#### 4. Scoring & Ranking Strategy
When `p_search` is provided (normalized: `q := lower(trim(p_search))`):
- **Exact / Substring Produce Match:**
  `CASE WHEN lower(p.name) = q THEN 100.0 WHEN lower(p.name) LIKE q || '%' THEN 60.0 WHEN lower(p.name) LIKE '%' || q || '%' THEN 40.0 ELSE 0.0 END`
- **Word Similarity on Produce Name:**
  `extensions.word_similarity(q, lower(p.name)) * 40.0`
- **Trigram Similarity on Produce Name:**
  `extensions.similarity(lower(p.name), q) * 30.0`
- **Category Match:**
  `CASE WHEN lower(c.name) LIKE '%' || q || '%' THEN 25.0 ELSE extensions.word_similarity(q, lower(c.name)) * 20.0 END`
- **Farmer Provenance Match:**
  `CASE WHEN lower(coalesce(f.business_name, '')) LIKE '%' || q || '%' THEN 20.0 WHEN lower(coalesce(f.full_name, '')) LIKE '%' || q || '%' THEN 15.0 ELSE extensions.word_similarity(q, lower(coalesce(f.business_name, ''))) * 15.0 END`
- **Description Keyword Match:**
  `CASE WHEN lower(coalesce(p.description, '')) LIKE '%' || q || '%' THEN 10.0 ELSE extensions.word_similarity(q, lower(coalesce(p.description, ''))) * 10.0 END`

**Relevance Threshold Cutoff:**
To prevent returning random low-similarity noise when a user enters gibberish (e.g. `"xyzqwerty"`), a listing must satisfy at least one threshold condition:
- Exact ILIKE match in name, category, farmer name/business, or description.
- OR `extensions.word_similarity(q, lower(p.name)) >= 0.3`
- OR `extensions.similarity(lower(p.name), q) >= 0.2`
- OR `extensions.word_similarity(q, lower(c.name)) >= 0.4`
- OR `extensions.word_similarity(q, lower(coalesce(f.business_name, ''))) >= 0.4`

#### 5. Security & Authorization Considerations
- **`SECURITY DEFINER` with fixed `search_path`:** Ensures consistent execution without search path injection vulnerabilities.
- **Strict Active Filter:** The query enforces `p.status = 'active'` at all times. Draft, out-of-stock (when filtered), or archived listings are never returned to public or business search.
- **Privacy Boundary Preservation:** The joined `farmer` JSONB strictly projects public fields (`clerk_id`, `full_name`, `business_name`, `city`, `avatar_url`, `bio`, `is_verified`). It NEVER projects sensitive attributes (`phone`, `address`, `status`, `created_at`).
- **Permissions:** Grant `EXECUTE` on function `public.search_products` to `anon`, `authenticated`, and `service_role`.

---

### B. Query & Application Layer

#### 1. Function Updates in `src/lib/supabase/queries/products.ts`
- **Upgrade `getActiveProducts`:**
  - Route the primary query through `supabase.rpc("search_products", { p_search, p_category_slug, p_in_stock_only, p_sort, p_limit, p_offset })`.
  - Maintain the existing fallback mechanism via `createAdminClient()` calling the RPC if the initial client encounters a connection issue.
  - Eliminate the post-query JavaScript `products.filter((p) => p.category?.slug === categorySlug)` since the database handles category filtering atomically before pagination.
- **Add `searchActiveProducts`:**
  - Export a dedicated function returning `{ products: Product[]; totalCount: number; page: number; totalPages: number }` for consumers needing pagination metadata.
- **Update TypeScript Interfaces:**
  - Update `ProductSort` type:
    ```ts
    export type ProductSort = "relevance" | "price_asc" | "price_desc" | "harvest_newest" | "newest" | "name_asc";
    ```
  - Update `ProductFilters` interface to support `p_sort: "relevance"` and optional pagination.

#### 2. Server vs. Client Boundary
- **Server Components:**
  - `/products` (`src/app/products/page.tsx`) and `/business/products` (`src/app/(dashboard)/business/products/page.tsx`) remain Server Components.
  - They read `searchParams: Promise<{ q?: string; category?: string; sort?: string; in_stock?: string }>` and pass them directly to `getActiveProducts`.
- **Client Components:**
  - `ProductFilters` (`src/components/products/product-filters.tsx`) remains the interactive filter control.
  - Adds an inline clear button (`RiCloseCircleLine` or `RiCloseLine`) inside the search input when `draftSearch` is non-empty.
  - Supports "Most Relevant" in the sort dropdown when a search query is active.

---

### C. UX & Interaction Design

#### 1. URL Preservation
- All existing query parameter conventions are preserved:
  - `q`: Search keyword.
  - `category`: Category slug.
  - `sort`: Sort key (`relevance`, `newest`, `harvest_newest`, `price_asc`, `price_desc`, `name_asc`).
  - `in_stock`: Boolean flag (`"true"` | `"false"`).
- Search URLs remain fully bookmarkable, linkable, and shareable.

#### 2. Search Feedback & Feedback State
- **Active Search Indicator:**
  - Display: `Showing results for "[q]"` with item count badge.
  - If a category is selected: `[Category Name] · Showing results for "[q]"`.
- **Typo Tolerance Feedback:**
  - When a user searches for `"Tomatp"`, the catalog displays "Ampayon Fresh Red Tomatoes" seamlessly without an error or zero-result barrier.
- **Empty State (No Results):**
  - When no products meet the threshold:
    - Clear icon (`RiSearchLine`).
    - Title: `"No produce matches your search"`.
    - Message: `We couldn't find any active produce matching "[q]". Try adjusting your spelling or clearing filters.`
    - Action: A prominent `"Clear search"` button removing `q` from the URL, alongside `"Clear all filters"`.

#### 3. Autocomplete / Live Suggestions Decision
- **Decision:** **DEFERRED to a later phase (Phase B or D).**
- **Rationale (Product Thinking & Scope Discipline):**
  - In an agricultural B2B wholesale marketplace, buyers search with deliberate intent (e.g. produce type, farm name, or crop).
  - Fast, server-rendered URL search with Suspense streaming is instant, accessible, mobile-friendly, and has zero client-side state bugs.
  - Autocomplete would introduce client-side debouncing, network churn on mobile, popover overlay management, and keyboard accessibility overhead without meaningfully improving the core transaction workflow.

---

### D. Comprehensive Test Plan

The test plan defines concrete automated and manual verification cases across all required behaviors:

| Test ID | Test Query / Condition | Expected Result | Verification Layer |
|---|---|---|---|
| **TEST-01** | `q=Tomatp` | Matches "Ampayon Fresh Red Tomatoes" via trigram similarity | SQL RPC & Browser |
| **TEST-02** | `q=Tomatoes` | Matches "Ampayon Fresh Red Tomatoes" | SQL RPC & Browser |
| **TEST-03** | `q=petchay` | Matches "Crisp Native Pechay (Bok Choy)" | SQL RPC & Browser |
| **TEST-04** | `q=talongg` | Matches "Fresh Native Eggplants (Talong)" | SQL RPC & Browser |
| **TEST-05** | `q=camot` | Matches "Yellow Sweet Camote (Sweet Potato)" | SQL RPC & Browser |
| **TEST-06** | `q=sweet mango` (multi-word) | Matches "Carabao Sweet Mangoes (Grade A)" at rank 1 | SQL RPC & Browser |
| **TEST-07** | `q=white rice` (multi-word) | Matches "Sinandomeng Polished White Rice" at rank 1 | SQL RPC & Browser |
| **TEST-08** | `q=brown eggs` (multi-word) | Matches "Farm-Fresh Brown Eggs (Tray of 30)" | SQL RPC & Browser |
| **TEST-09** | `q=free range chicken` | Matches "Dressed Free-Range Whole Chicken" | SQL RPC & Browser |
| **TEST-10** | `q=Verdant Ridge` | Matches all active produce listed by Verdant Ridge Demo Farm | SQL RPC & Browser |
| **TEST-11** | `q=Golden Harvest` | Matches all active produce listed by Golden Harvest Demo Agro | SQL RPC & Browser |
| **TEST-12** | `q=Vegetables` (category query) | Matches all produce under the Vegetables category | SQL RPC & Browser |
| **TEST-13** | `q=fresh&category=vegetables` | Returns only vegetable products matching "fresh" | SQL RPC & Browser |
| **TEST-14** | `q=rice&sort=price_asc` | Returns Sinandomeng (₱48/kg) before Dinorado (₱1,250/sack) | SQL RPC & Browser |
| **TEST-15** | `q=organic&in_stock=true` | Returns only items with `quantity_available > 0` | SQL RPC & Browser |
| **TEST-16** | `q=xyzqwerty999` (gibberish) | Returns 0 rows; clean empty state with clear search button | SQL RPC & Browser |
| **TEST-17** | SQL Injection: `q=' OR 1=1 --` | Treated as literal text; returns 0 rows; no error | Security SQL Audit |
| **TEST-18** | Security / Draft Exclusion | Draft and archived products never returned in search | Database Assertion |
| **TEST-19** | Security / Privacy Boundary | Farmer phone and address are not present in search payload | Payload Inspection |
| **TEST-20** | Pagination Count Integrity | Category filter returns exact limit requested (e.g. 24) without in-memory truncation | Database Assertion |

---

### E. Migration & Rollout Strategy

1. **Test Environment Execution First:**
   - Apply migration `20260926000001_smart_search.sql` strictly to the dedicated UMA test/security Supabase project (`odnpkqjytrmciwmcehff`).
   - Run verification test script against test database using signed Clerk tokens and anonymous client.
2. **Performance Validation:**
   - Execute `EXPLAIN ANALYZE` on `search_products` with sample queries.
   - Assert GIN index scans on `idx_products_name_trgm` and total execution time < 15ms.
3. **Pre-Merge Validation Gates:**
   - `npm run lint` passes with 0 errors and 0 warnings.
   - `npm run build` compiles cleanly with Turbopack (all routes dynamic/static valid).
   - Automated test script passes 20/20 test cases.
   - Working tree remains clean.
4. **Production Rollout Steps (Later):**
   - Push migration via Supabase CLI (`supabase db push`) to production Supabase during deploy window.
   - Zero application downtime; RPC is backwards-compatible.

---

### F. Scope Control Boundaries

#### MVP Scope (This Phase A):
- Enable `pg_trgm` and create GIN trigram indexes on produce, category, and farmer names.
- Create atomic `search_products` PostgreSQL RPC with ranking, filtering, and pagination count.
- Update `getActiveProducts` to use RPC and fix category pagination truncation bug.
- Update `ProductFilters` with inline search clear button and relevance sort option.
- Test and verify all 20 test cases.

#### Optional Later Enhancements (Phase B / D):
- Instant typeahead dropdown suggestions.
- Popular search queries and search telemetry.
- "Did you mean [spelling]?" recommendation banner.

#### Strictly Out of Scope (Do NOT Build):
- External search services (Algolia, Meilisearch, Elasticsearch).
- Client-side full catalog indexing libraries (FlexSearch, Fuse.js).
- Unauthenticated access to private farmer data.
- Redesign of product cards, dashboard layouts, or unrelated pages.

---

## 3. Deliverables Summary

1. **Proposed Files to Change:**
   - `src/lib/supabase/queries/products.ts`: Update `getActiveProducts`, add `searchActiveProducts`, add `"relevance"` sort type, remove in-memory category filter.
   - `src/components/products/product-filters.tsx`: Add clear-search button, support "Most Relevant" sort option.
   - `src/app/products/page.tsx`: Pass sort and display active search feedback.
   - `src/app/(dashboard)/business/products/page.tsx`: Align with updated search query helper.
2. **Proposed Migration:**
   - `supabase/migrations/20260926000001_smart_search.sql`: Enable `pg_trgm`, create GIN trigram indexes, create `search_products` RPC, grant permissions.
3. **Proposed Test Script:**
   - `scripts/verify-smart-search.ts`: Automated runner verifying all 20 test cases against remote Supabase.
4. **Implementation Order:**
   - Step 1: Author migration `20260926000001_smart_search.sql` and apply to test database.
   - Step 2: Update `src/lib/supabase/queries/products.ts` and test RPC queries.
   - Step 3: Update `ProductFilters` and search page UI feedback.
   - Step 4: Execute automated test suite (`verify-smart-search.ts`) and browser subagent tests.
   - Step 5: Verify `npm run lint` and `npm run build`.
