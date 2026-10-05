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
