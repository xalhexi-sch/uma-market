# UMA Market — Checkout / Order / Inventory Hardening Verification Harness

**Document Version:** 1.0.0  
**Harness Script:** [`scripts/verify-checkout-orders.ts`](file:///c:/Users/USER/Desktop/uma-market/scripts/verify-checkout-orders.ts)  
**Safety Scope:** Dedicated Security-Test Environment Only  
**Target Project Ref:** `xckdihprwjdwutglytwu`  

---

## 1. Purpose

The `scripts/verify-checkout-orders.ts` script is an automated verification suite designed specifically for the dedicated security-test environment. Its purpose is to validate **database-level** invariants, triggers, schema constraints, RPC authentication gates, and anonymous RLS protections across UMA Market's checkout, ordering, and inventory subsystems.

This harness operates directly at the PostgreSQL layer via Supabase clients to assert that structural integrity and database-level protections hold true under various operational conditions without relying on manual database inspections.

---

## 2. Safety Boundary & Hard Guards

Because UMA Market handles real pilot farmer and buyer data in production, running mutation tests against production is **strictly prohibited**. The verification harness implements layered safety checks at module-load time:

1. **Production URL Lock:**  
   The script checks `process.env.NEXT_PUBLIC_SUPABASE_URL` immediately upon execution. If the URL contains the live production reference (`odnpkqjytrmciwmcehff`), it outputs an error message and terminates with exit code `2` before initializing any client or executing any queries.
2. **Exact Target Matching:**  
   The script requires `NEXT_PUBLIC_SUPABASE_URL` to match exactly the dedicated security-test endpoint:  
   `https://xckdihprwjdwutglytwu.supabase.co`  
   Any unmatched or unspecified project URL results in an immediate abort (exit code `2`).
3. **Secret Hygiene:**  
   `SUPABASE_SECRET_KEY` is utilized strictly server-side by the `adminClient` for deterministic fixture provisioning, direct trigger stimulation, and teardown. The script strictly forbids logging, printing, or echoing secrets, keys, or tokens to the console or log files.

---

## 3. Test Categories

The harness separates checks into three distinct categories to maintain clear distinctions between static configuration assertions, direct database-level verifications, and end-to-end flows:

| Category | Description | Execution Mechanism |
| :--- | :--- | :--- |
| **`[STATIC]`** | Environment variable and configuration assertions. No network calls or DB mutations. | Process environment evaluation (`S-01` to `S-03`). |
| **`[DATABASE]`** | Direct database tests exercising PostgreSQL constraints, triggers, RPC authentication gates, and anonymous RLS. | Supabase `adminClient` (`service_role`) and `anonClient` (`S-04`, `D-01` to `D-22`). |
| **`[AUTH E2E STUB]`** | Documented coverage gaps that cannot be exercised using `service_role`. Requires authenticated Clerk user sessions. | Stubs outputted to report (`AUTH-E2E-01` to `AUTH-E2E-08`). |

### Why `service_role` Cannot Exercise Authenticated RPC Paths

UMA Market's core checkout and status functions (`place_checkout_orders` and `update_order_status`) are PostgreSQL `SECURITY DEFINER` routines. Their first action is asserting identity:
```sql
v_clerk_id := auth.jwt()->>'sub';
IF v_clerk_id IS NULL THEN
  RAISE EXCEPTION 'Not authenticated';
END IF;
```
When invoked with the Supabase `service_role` key, `auth.jwt()` evaluates to `NULL`. The RPC immediately aborts at the authentication gate before evaluating business logic, order creation, inventory decrements, or state transition validations. Consequently, calling these RPCs via `service_role` only validates the presence of the authentication gate, not the functional business flow.

---

## 4. Database Coverage (`D-01` through `D-22`)

The harness validates 22 specific database-level checks across five functional sections:

### Section 2: RPC Auth Gates
* **`D-01`**: `place_checkout_orders` rejects unauthenticated callers (`auth.jwt()->>'sub'` gate active).
* **`D-02`**: `update_order_status` rejects unauthenticated callers (`auth.jwt()->>'sub'` gate active).

### Section 3: Schema Constraints
* **`D-03`**: `products.quantity_available CHECK (quantity_available >= 0)` constraint blocks negative inventory updates.
* **`D-04`**: Confirms product stock remains unchanged following a rejected negative update attempt.
* **`D-05`**: `cart_items.quantity CHECK (quantity > 0)` constraint blocks non-positive quantities.
* **`D-06`**: `order_items.quantity CHECK (quantity > 0)` constraint blocks non-positive quantities.
* **`D-07`**: `products.min_order_quantity` column correctly persists and reads configured MOQ values.

### Section 4: Cancellation Stock-Restoration Trigger (`trg_restore_stock_on_cancelled`)
* **`D-08`**: Pre-condition verification: stock is decremented via direct administrative update.
* **`D-09`**: Order status updates successfully from `pending` to `cancelled`.
* **`D-10`**: Trigger automatically restores decremented stock to original levels upon transition from `pending` to `cancelled`.
* **`D-11`**: `trg_enforce_order_terminal_status` blocks reopening a `cancelled` order back to `pending`.
* **`D-12`**: Trigger `WHEN` guard verification: stock is **not** restored when cancelling an order from `ready` (guard restricts restoration to `pending` and `accepted`).

### Section 5: Terminal State Protection Trigger (`trg_enforce_order_terminal_status`)
* **`D-13`**: Trigger blocks status transition `cancelled` → `pending`.
* **`D-14`**: Trigger blocks status transition `cancelled` → `completed`.
* **`D-15`**: Trigger blocks status transition `cancelled` → `accepted`.
* **`D-16`**: Trigger blocks status transition `completed` → `pending`.
* **`D-17`**: Trigger blocks status transition `completed` → `cancelled`.
* **`D-18`**: Trigger blocks status transition `completed` → `accepted`.

### Section 6: Anonymous RLS Verification (Baseline Floor)
* **`D-19`**: Anonymous client querying `orders` returns `0` rows (RLS policy enforced).
* **`D-20`**: Anonymous client querying `order_items` returns `0` rows (RLS policy enforced).
* **`D-21`**: Anonymous client querying `cart_items` returns `0` rows (RLS policy enforced).
* **`D-22`**: Admin client sanity read verifies the test order exists and is readable under `service_role`.

---

## 5. Authenticated E2E Gaps (`AUTH-E2E-01` through `AUTH-E2E-08`)

The following requirements cannot be tested by database-level service scripts and require a real Clerk JWT and a live Next.js application session:

* **`AUTH-E2E-01`**: Multi-farmer checkout atomicity via `place_checkout_orders` (creating multiple orders across farmer splits, decrementing stock, clearing cart in one transaction).
* **`AUTH-E2E-02`**: Insufficient stock rejection and complete transactional rollback (0 orders created, 0 stock decrements).
* **`AUTH-E2E-03`**: MOQ rejection through authenticated checkout (item quantity below `min_order_quantity`).
* **`AUTH-E2E-04`**: Farmer `update_order_status` valid lifecycle (`pending` → `accepted` → `preparing` → `ready` → `completed`) and invalid skipping transitions.
* **`AUTH-E2E-05`**: Buyer `cancelOrder` Server Action execution and trigger-based stock restoration.
* **`AUTH-E2E-06`**: Authenticated cross-tenant RLS isolation (Buyer B session querying Buyer A orders yields 0 rows).
* **`AUTH-E2E-07`**: Role-based RPC authorization check (Buyer JWT calling `update_order_status` raises "Only farmers can update order status").
* **`AUTH-E2E-08`**: Revoked profile access prevention (`assertActiveProfile` in `actions/orders.ts` blocks checkout when profile status is revoked).

*Execution Context:* These checks must be executed through the Campaign 4 browser/Puppeteer test harness with Clerk test accounts (`buyer.test@example.com`, `farmer.test@example.com`).

---

## 6. Environment Prerequisites & Execution

To run `scripts/verify-checkout-orders.ts`, the target environment must satisfy:

1. **Security-Test Project Reference:**  
   The target database must be Supabase project `xckdihprwjdwutglytwu`.
2. **Applied Migrations:**  
   Migrations `20260922000001` through `20260924000004` must be fully deployed.
3. **Seeded Baseline Data:**  
   The database must contain baseline categories (specifically `vegetables` slug). If unseeded, run:
   ```bash
   npm run seed:demo
   ```
4. **Environment Variables:**  
   `.env.local` must be configured with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xckdihprwjdwutglytwu.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<test-publishable-key>
   SUPABASE_SECRET_KEY=<test-service-role-secret-key>
   ```
5. **Execution Command:**
   ```bash
   npx tsx scripts/verify-checkout-orders.ts
   ```

---

## 7. Fixture Lifecycle & Teardown

To prevent test interference and guarantee clean state, the harness manages fixtures deterministically:

1. **Deterministic Test IDs:**  
   All fixture records use fixed UUIDs prefixed with `t0000001-`:
   * Farmers: `...0001`, `...0002`
   * Buyers: `...0101`, `...0102`
   * Products: `...0201` (`productA1`), `...0202` (`productA2`), `...0211` (`productB1`), `...0221` (`productLow`), `...0222` (`productMOQ`)
2. **Pre-Run Cleanup:**  
   Before running any provisioning, `cleanupFixtures()` executes to purge leftover artifacts from prior interrupted runs.
3. **Provisioning:**  
   `provisionFixtures()` upserts required profiles and products tied to the `vegetables` category.
4. **Guaranteed Post-Run Teardown:**  
   Database tests are wrapped in a `try...finally` block. `cleanupFixtures()` is guaranteed to execute even if assertions fail or an unhandled exception occurs.
5. **Cleanup Failure Handling:**  
   `cleanupFixtures()` tracks errors on every delete operation (`order_items`, `orders`, `cart_items`, `products`, `profiles`). If any cleanup query returns an error, the function throws an exception, logs details, and causes the process to exit with non-zero status.

---

## 8. Important Limitations

This script **does not prove**:
* Real end-to-end authenticated checkout flows.
* Authenticated cross-tenant data isolation between different authenticated users.
* Clerk authentication token parsing or Clerk session lifecycle.
* Server Action execution logic in Next.js (`placeMultiFarmerCheckout`, `cancelOrder`).

Those capabilities reside strictly in the Authenticated E2E testing domain.

---

## 9. Failure Recovery & Reset Procedure

If a test run is abruptly halted (e.g., process killed or connection lost) and `cleanupFixtures()` fails to clean the deterministic test data, follow the recovery procedure documented in `docs/security/SECURITY-TEST-ENVIRONMENT.md` §8:

1. In the Supabase SQL Editor for project `xckdihprwjdwutglytwu`, truncate test transaction tables:
   ```sql
   TRUNCATE TABLE public.messages CASCADE;
   TRUNCATE TABLE public.cart_items CASCADE;
   TRUNCATE TABLE public.order_items CASCADE;
   TRUNCATE TABLE public.orders CASCADE;
   ```
2. Reset profiles and inventory to a clean baseline by re-running:
   ```bash
   npm run seed:demo
   ```
