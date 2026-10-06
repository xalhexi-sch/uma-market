# UMA V4 — Security Model

## 1. Security hierarchy

```text
Clerk
 ↓
identity/session
 ↓
UMA business membership + role/capability
 ↓
resource ownership/access
 ↓
Supabase RLS / trusted RPC
```

UI gating is convenience only.

## 2. Membership security

A request that contains a business ID must verify that the authenticated user is a current member of that business.

Never trust a client-provided active-business ID without server-side validation.

## 3. Fixed roles

```text
OWNER
STAFF
```

Owner has business administration.

Staff has ordinary operational access.

Do not expose a user-editable permission matrix.

## 4. BUY / SELL capability

A business can:

```text
BUY
SELL
BUY + SELL
```

Capability controls which product actions are available but does not replace resource ownership checks.

## 5. Critical authorization areas

Test:

- reading another business's orders;
- editing another business's listing;
- deleting another business's listing;
- viewing another business's messages;
- changing another business's inventory;
- using another business's cart;
- accessing admin routes without platform-admin authorization.

## 6. Commerce invariants

Checkout must enforce server-side:

- buyer authorization;
- active seller/business status;
- current price;
- current inventory;
- MOQ;
- availability;
- fulfillment details.

`order_items` should not be directly forgeable by ordinary clients.

## 7. Inventory

Prevent:

- overselling;
- lost-update races;
- arbitrary stock increases by unauthorized users;
- stock restoration from invalid transitions.

Use atomic server-side SQL operations.

## 8. Order transitions

Only valid state transitions may happen.

Transition functions should verify the actor and business relationship before changing state.

## 9. Moderation

Keep producer lifecycle state separate from platform moderation state where both actors can change information.

A producer should not be able to undo an admin moderation action simply by editing their own product.

## 10. Messaging

A user must only access a conversation if their active business is a participant business.

Context references must be validated too:

```text
conversation participant
     ↓
may reference product?
may reference order?
```

## 11. File uploads

Validate:

- type;
- size;
- ownership;
- storage path;
- deletion rights.

Never expose private storage credentials to the client.

## 12. Error handling

Do not return raw database/exception details to ordinary users.

Use stable user-facing error categories and log details server-side.

## 13. Rate limiting

Apply distributed rate limits where abuse matters:

- authentication-sensitive endpoints;
- message sends;
- sensitive mutations;
- expensive search or query endpoints.

Do not add a rate limit to every endpoint without evidence.

## 14. Verification matrix

Every security-sensitive feature should have tests for:

```text
allowed
 ├── owner
 ├── staff (when allowed)
 └── correct business context

blocked
 ├── unauthenticated
 ├── wrong business
 ├── wrong role
 ├── inactive/suspended
 └── admin escalation
```

## 15. V4 pre-migration findings

The earlier static audit identified several areas that must be reproduced/fixed before broader migration, including order-line direct write risk, inactive/suspended status enforcement, moderation state separation, and inventory lost-update behavior.

Treat static findings as **CODE-REVIEWED until runtime verification proves them**.

## 16. V4 Phase 0 stop-ship fixes (runtime-verified)

Migrations (applied to the security-test project only; **not yet applied to production**):

- `supabase/migrations/20261005000003_v4_phase1_security_stopship.sql`
- `supabase/migrations/20261005000004_v4_phase1_moderation_invariant.sql`

| ID | Finding | Fix | Status |
|---|---|---|---|
| SEC-OI-001 | Buyers could INSERT `order_items` directly (forged price/quantity) | Dropped policy `"order_items: business inserts"`; lines are written only by the SECURITY DEFINER checkout RPCs | VERIFIED |
| SEC-SELL-001 | Checkout accepted orders to suspended/revoked sellers | `place_checkout_orders` and `place_order` raise `Seller account is <status> and cannot accept orders` when the seller profile is not `active` | VERIFIED |
| SEC-MOD-001 | A producer could undo admin moderation by re-activating a product | New `products.moderation_status` (`approved`/`flagged`/`suspended`) + trigger `trg_protect_product_moderation`: only admin JWT / service_role may change it, and a moderated product cannot be activated | VERIFIED |
| SEC-MOD-002 | SECURITY DEFINER paths (`search_products`, checkout) filter only on `status='active'` | CHECK `products_active_requires_approval` (`status <> 'active' OR moderation_status = 'approved'`); public read policy also requires `moderation_status='approved'` | VERIFIED |

Admin moderation contract: set `moderation_status` and a non-active `status` (e.g. `archived`) in the **same** UPDATE; lifting moderation sets `approved` + `active` together.

Evidence: `npm run verify:v4-phase1` (26/26). The `LIVE-*` cases use real Clerk Development session JWTs (buyer, producer, admin personas), not service_role:

- `LIVE-OI-001` buyer INSERT into own order's `order_items` rejected; zero rows written (control `LIVE-OI-000`: buyer can read the order).
- `LIVE-SELL-{suspended,revoked}-{a,b}` both RPCs reject; no order lines created (control `LIVE-SELL-active`: identical checkout succeeds once seller is active).
- `LIVE-MOD-001..003` producer cannot reactivate, cannot change `moderation_status`, cannot do both at once (control `LIVE-MOD-000`: producer can edit other fields; `LIVE-MOD-004`: admin JWT can approve + reactivate).

Still open from §15: inventory lost-update behaviour (UNVERIFIED; out of Phase 0 scope).

## 17. V4 producer operations — listings + inventory

Migration (security-test project only; **not applied to production**):
`supabase/migrations/20261006100000_v4_producer_listings_inventory.sql`.

Boundary for every producer write:

```text
server action  → requireCanSell(): signed in, active profile, member of the
                 server-resolved active business, business has SELL
trusted RPC    → repeats: active caller, membership, active business, SELL;
                 listing must belong to the business (else UMN01)
```

| ID | Risk | Control |
|---|---|---|
| SEC-INV-001 | Lost update / last-write-wins stock (legacy farmer form wrote `quantity_available` directly) | Trigger `trg_products_10_guard_client_writes` rejects any direct client (`authenticated`/`anon`) change to `quantity_available`; stock changes only via `adjust_business_inventory` under the product row lock |
| SEC-INV-002 | Negative stock / oversell | Loss larger than stock rejected in SQL; `quantity_available >= 0` CHECK; checkout and adjustments lock the same row |
| SEC-INV-003 | Stale count silently undoing a sale | Count correction is compare-and-set on the balance the producer saw |
| SEC-INV-004 | Forged or deleted audit rows | `inventory_movements` has no client INSERT/UPDATE/DELETE grants; rows written only by a SECURITY DEFINER trigger |
| SEC-LST-001 | Cross-business listing edits | RPCs take the server-resolved business and verify `products.business_id`; client `business_id` on direct INSERT is discarded and cannot be changed by UPDATE |
| SEC-LST-002 | STAFF / non-farmer members locked out, or BUY-only members let in | Access is by membership + SELL capability, not Clerk role; read RLS uses `current_seller_business_ids()` |
| SEC-LST-003 | Producer overriding moderation | No moderation parameter exists; RPCs refuse to publish a moderated listing; existing trigger + CHECK still enforce it |
| SEC-LST-004 | Photo path injection | New photo paths must be in the caller's own storage folder (`starts_with`, no LIKE wildcards); storage upload limited to members of active SELL businesses; bucket enforces type/size |

Errors: RPCs raise `42501` / `UMV01` / `UMC01` / `UMN01`; the app surfaces only
messages authored in the migration (`src/lib/producer-ops-errors.ts`).

Evidence: `npm run verify:v4-producer-ops-rules` (deterministic) and
`npm run verify:v4-producer-ops-live` (real Clerk Development JWTs, including
live OWNER-vs-STAFF concurrency and checkout-vs-loss races). Browser:
`tests/browser/v4-producer-ops.spec.ts`. See the task report for which of these
have been executed.

## 18. F9 — business OWNER column-restricted UPDATE (runtime-verified)

Migration (security-test project only; **not applied to production**):
`supabase/migrations/20261009000000_v4_business_owner_rls_hardening.sql`.

Finding: `"businesses: owner can update business"` is a **row** policy. Postgres
RLS cannot restrict individual columns — a policy only ever sees the new row —
so an authenticated OWNER could rewrite `can_buy`, `can_sell`, `status` and
`created_at` on their own business (grant themselves capabilities, lift a
platform suspension). Reproduced live before the fix.

Control: `trg_businesses_20_guard_client_writes` — a `SECURITY INVOKER`
`BEFORE UPDATE` trigger on `public.businesses`, the same pattern as
`trigger_guard_product_client_writes` and `trigger_guard_business_identity`.
`current_user` is `authenticated`/`anon` only for a direct PostgREST write;
`service_role` and SECURITY DEFINER paths fall through untouched.

| Column | Direct client (`authenticated` / `anon`) | Platform (`service_role` / SECURITY DEFINER) |
|---|---|---|
| `name` | allowed | allowed |
| `updated_at` | allowed (server-overwritten anyway) | allowed |
| `can_buy` | **forbidden** (`42501`) | allowed |
| `can_sell` | **forbidden** (`42501`) | allowed |
| `status` | **forbidden** (`42501`) | allowed |
| `legacy_clerk_id` | **forbidden** (`42501`) | allowed |
| `id` | **forbidden** (`42501`) | allowed |
| `created_at` | **forbidden** (`42501`) | allowed |

Policy surface is unchanged: one `UPDATE` policy (OWNER only), no `INSERT` or
`DELETE` policies on `businesses`, and `business_members` stays default-deny —
so STAFF gain no owner-only mutation right and no membership escalation path.
No client-side workaround was added: the application performs no writes to
`businesses`, so no RPC or server action exists to bypass the guard.

A column added to `businesses` later must be added to the guard, otherwise it
silently joins the allowed set.

Evidence: `npm run verify:v4-business-owner-rls` (32/32, real Clerk Development
JWTs for OWNER / STAFF / foreign OWNER / admin plus anon and `service_role`).
Regression: `npm run verify:v4-business-provisioning` (39/39, F1 untouched) and
`npx playwright test tests/browser/v4-dashboard.spec.ts` (9/9 — business
switching and OWNER-vs-STAFF dashboard behaviour unchanged).

## 19. SEC-AUTH-001 — account-status route gate (V4 routes)

A revoked/suspended `profiles.status` (set by the verified Clerk webhook or an admin) must deny protected V4 pages with a **real HTTP 307**, not a streamed in-page redirect.

Placement rule: `loading.tsx` wraps the page — but not the same segment's `layout.tsx` — in a Suspense boundary. A `redirect()` issued after that boundary streams can only emit a 200 + meta refresh. The gate therefore runs in segment layouts, before anything streams:

```text
src/platform/account-gate.ts   redirectIfAccountInactive()
  signed in + profile.status ≠ 'active'  → 307 /sign-in?revoked=true
  unauthenticated / missing profile      → pass through (route's own sign-in / onboarding flow)

src/app/{dashboard,orders,cart,checkout,messages}/layout.tsx  → call the gate
```

The profile read shares `getProfileForUser()`'s per-request cache with `requireActiveUser()`, so the page's business resolution adds no extra query. `/orders`, `/cart` and `/checkout` page-level `ACCOUNT_INACTIVE` handling re-runs the gate before the onboarding fallback, so an inactive account never lands on `/onboarding`. Public routes have no gate; `/sign-in` is ungated, so the redirect cannot loop.

Authorization still rests on the server-side helpers and RLS/RPCs (e.g. `place_v4_checkout_orders` refuses a non-active caller); the gate is the navigation-level denial.

Evidence: `tests/browser/sec-auth-001-session-revocation.spec.ts` (001a–001e) asserts status `307` + `Location: /sign-in?revoked=true` for `/dashboard/orders`, `/orders`, `/cart`, `/checkout`; active accounts stay on the route; no loop. Negative control: with the `/orders` layout gate removed, 001e fails with `Expected: 307, Received: 200`.

Residual (by design, §7.1 of the remediation record): a Clerk session revocation alone does not invalidate an already-issued JWT; the window is bounded by the token TTL (≤ 60 s) and closes immediately once the webhook sets `profiles.status`.
