# UMA V4 — Architecture

## 1. Target in one picture

```text
                           UMA
                            │
          ┌─────────────────┼─────────────────┐
          ↓                 ↓                 ↓
     Marketplace         Commerce           Trust
          │                 │                 │
      Products           Cart/Orders      Reviews
      Producers          Inventory        Verification
      Search             Fulfillment      Reports
      Categories         Order Events     Moderation
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ↓
                        Messaging
                            │
                 one conversation per
                 business relationship
                            ↓
                       Notifications
                            ↓
                        Smart Rules
                            ↓
                      Authorization
                            ↓
                  Clerk + Supabase/RLS
```

## 2. Architecture style

Use a **modular monolith**.

One Next.js application, one Supabase/Postgres system, clear internal domain boundaries.

This is intentional. UMA does not currently need microservices, Kafka, Kubernetes, GraphQL, a separate search service, or a distributed event platform.

## 3. Top-level layers

```text
src/app
  page composition + routing only

src/domains
  business rules by domain

src/components/ui
  shadcn primitives

src/components/patterns
  shared product-wide compositions

src/platform
  auth, authorization, routes, Supabase, logging, errors, caching, rate limits
```

### Platform layer — Phase 1 implementation status

Implemented in `src/platform/`:

| Module | File | Purpose |
|---|---|---|
| auth | `auth.ts` | `requireUser`, `requireRole`, `requireActiveUser`, `requireActiveRole` |
| actions | `actions.ts` | `createAction` wrapper, `ActionResult<T>` type |
| errors | `errors.ts` | `AppError`, `ErrorCode`, `safeErrorMessage`, `errorCode` |
| logging | `logging.ts` | Structured JSON logger (`log.info/warn/error/debug`) |
| routes | `routes.ts` | Centralized route map, `dashboardRoot()` |
| barrel | `index.ts` | Re-exports all public API |

Existing action files continue to work unchanged. New actions should use `createAction()` + `requireActiveRole()`. Migration is incremental.

## 4. Domain boundaries

### Identity
User identity and account state.

### Businesses
Business entities, memberships, active business selection, Owner/Staff behavior.

### Catalog
Products/listings, categories, images, aliases, search.

### Inventory
Current inventory plus movement history and atomic adjustments.

### Orders
Cart, checkout, state machine, fulfillment, immutable order lines.

### Messaging
Business-to-business conversation, messages, unread state, context attachments.

### Notifications
Event-derived in-app notifications and preferences.

### Reviews
Verified product/seller review flows.

### Trust
Verification and derived trust signals when implemented.

### Admin
Platform moderation, verification queue, reports, audit.

## 5. Cross-domain rule

Domains import each other through their public `index.ts` interface.

Do not import deep internal files across domains unless explicitly justified.

Enforce boundaries through lint/config where practical.

## 6. Server-first rule

Use Server Components by default.

Client Components are for:

- interactive controls;
- browser APIs;
- realtime chat;
- upload interactions;
- optimistic UI where safe.

Business rules stay server-side.

## 7. Authorization

The browser never decides access.

```text
Clerk identity
    ↓
Active business membership
    ↓
Owner/Staff + BUY/SELL capability
    ↓
Resource access
    ↓
Supabase RLS / trusted SQL
```

## 8. Business context

One user can have multiple businesses.

The active business is a server-validated context value, not a client-trusted identifier.

Initially only `OWNER` and `STAFF` are supported.

## 9. Messaging decision

One conversation per business pair/relationship.

Products and orders are optional message context, not separate conversation identities.

This keeps the UX simple and avoids chat fragmentation.

## 10. Smart logic

Use deterministic rules based on actual data:

- search aliases/typos;
- purchase history;
- favorites;
- stock changes;
- order age/status;
- location/area data.

No AI API dependency is part of V4.

## 11. Explicit non-goals

Not now:

- microservices;
- Kafka/queue platform;
- Kubernetes;
- GraphQL;
- dedicated search service;
- configurable enterprise RBAC;
- native mobile application;
- full payment platform;
- AI API dependency;
- full Clerk Organizations dependency.

## 12. Migration principle

```text
expand → backfill → dual read/write when needed → migrate → soak → contract
```

Never make a destructive change just to make the code look cleaner.
