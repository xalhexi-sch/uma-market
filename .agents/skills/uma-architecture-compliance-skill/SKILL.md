---
name: uma-architecture-compliance
description: Audit and harden the UMA Market codebase against its documented course lessons and project architecture. Use when reviewing, refactoring, testing, or planning changes involving Next.js, MVC, client-server/3-tier architecture, CRUD, SDLC, integrations, rendering, data access, or engineering quality. Distinguish lesson-supported requirements from recommended production improvements and unverified code-review observations.
---

# UMA Market — Architecture Compliance & Hardening

## Purpose

Use this skill to keep UMA Market aligned with the actual lessons and documented project architecture while improving correctness, maintainability, security, performance, and testability.

This is an **audit-first** skill. Do not turn every modern engineering practice into a mandatory requirement. Do not rewrite large parts of the codebase simply because a pattern is fashionable.

## Project Context

UMA Market is an agricultural B2B marketplace for Butuan/Caraga.

Known stack and architecture:
- Next.js 16 App Router + Turbopack
- React Server Components by default
- Server Actions for mutations where appropriate
- Clerk for authentication
- Supabase for PostgreSQL/database, Realtime, and Storage
- TypeScript, Tailwind CSS, shadcn/ui
- Public-first site with protected `/business`, `/farmer`, `/admin`, and `/onboarding` areas
- `src/proxy.ts` for request/auth protection
- Query/model code under `lib/supabase/queries/`
- Server Action/controller code commonly colocated in feature folders
- Existing realtime use for order status/chat
- Existing webhook integration for Clerk → profile synchronization

Preserve working architecture unless a concrete defect, requirement gap, security issue, or justified lesson-aligned refactor requires change.

---

## Operating Rules

### 1. Audit before changing

Before modifying code:
1. Understand the relevant feature and its data flow.
2. Inspect the existing implementation and nearby conventions.
3. Identify the exact requirement or lesson principle involved.
4. Verify with commands/tests when possible.
5. Classify the finding.
6. Make the smallest coherent change.
7. Re-run relevant checks.

Never start with a broad rewrite.

### 2. Separate evidence levels

Every finding must be labeled internally as one of:

- **VERIFIED** — confirmed by actually running a command, test, build, or reproducible behavior.
- **CODE-REVIEWED** — supported by source inspection but not executed.
- **UNVERIFIED** — plausible but dependent on runtime behavior or missing context.

Never present an unverified observation as a confirmed defect.

### 3. Separate priority classes

Use these classes in audit reports:

- **REQUIRED** — directly supported by UMA requirements or one of the supplied course lessons.
- **RECOMMENDED** — sound engineering improvement that is not required by the lessons.
- **OPTIONAL** — future product capability or scope expansion.

A missing optional feature is not a compliance failure.

### 4. Do not over-engineer

Do not introduce a new library, abstraction, API, service, infrastructure layer, or product feature merely because it is considered modern or production-grade.

Require at least one concrete justification:
- documented UMA requirement;
- lesson-aligned architectural concern;
- demonstrated correctness/security defect;
- measurable performance problem;
- repeated maintenance problem;
- clear integration requirement.

Avoid adding microservices, queues, complex state machines, distributed infrastructure, or unnecessary abstractions to solve problems that a simple Next.js/Supabase design handles correctly.

### 5. Preserve legitimate exceptions

Not every direct database call or client-side import is automatically wrong. Evaluate the actual responsibility.

Examples:
- Supabase Realtime subscriptions may legitimately live in a client component.
- Browser-side Storage uploads may be legitimate when the design intentionally uses a client upload flow.
- A small query that is inherently presentation-specific may be acceptable when extracting it would add needless abstraction.

The question is whether the dependency violates the intended separation of concerns or creates avoidable duplication/coupling.

---

# Lesson Contract

These are the project’s governing lesson-aligned principles. Treat them as the source of truth for course compliance.

## A. Client–Server / Three-Tier Architecture

UMA should maintain clear responsibility boundaries:

**Browser/client → Next.js application/server → Supabase database/services**

The client handles presentation and user interaction.
The application/server handles request orchestration, authentication/authorization, business operations, and data access boundaries.
The database enforces data integrity and persistent data rules.

Check for:
- secrets/API keys leaking to the client;
- business-critical mutations performed only in the browser;
- unnecessary coupling between UI and database details;
- duplicated business rules across client and server.

Do not require a physically separate application server if Next.js is already fulfilling that server/application role.

## B. MVC / Separation of Concerns

Use a practical MVC interpretation for the App Router architecture:

**Model**
- data access;
- data-related business rules;
- persistence-oriented operations;
- query functions and reusable domain/data logic.

**View**
- pages/components;
- presentation;
- UI state and interaction rendering.

**Controller**
- Server Actions / request handlers;
- interpret input;
- validate authorization and arguments;
- orchestrate model operations;
- return/redirect/revalidate as appropriate.

Prefer:
`View → Controller → Model → data source`

Do not make Views own database access unless there is a clearly justified client-side exception.
Do not let Models depend on UI components.

When direct `.from()` calls occur inside actions:
- determine whether they are model logic accidentally living in the controller;
- move reusable persistence operations into the query/model layer when appropriate;
- avoid creating trivial one-function wrappers solely to satisfy a slogan.

## C. CRUD Integrity

Evaluate requirements through the full data lifecycle:
- Create
- Read
- Update
- Delete

For each important entity/requirement, ask:
1. Where is it created?
2. Where is it read?
3. Where is it updated?
4. Where is it deleted/retired/cleared, where applicable?
5. What screen/action performs each operation?
6. What database constraint protects it?

A field or requirement stored in the database but never exposed through a meaningful operation is a likely CRUD completeness gap.

For SQL/data access:
- prefer targeted columns over `SELECT *` when the result shape is known and stability/performance/readability benefit from it;
- use `WHERE` for targeted updates/deletes;
- use appropriate filtering and ordering;
- use pagination for potentially large collections;
- preserve referential integrity with appropriate foreign keys and delete behavior.

Do not call the existence of `SELECT *` a catastrophic bug. Classify it as a precision/performance/maintainability improvement unless it causes a concrete defect.

## D. Next.js

Follow the App Router model intentionally:
- Server Components by default;
- Client Components only where interactivity/browser APIs require them;
- Server Actions for server-side mutations when suitable;
- Route Handlers for HTTP endpoints where appropriate;
- nested layouts for shared UI;
- `loading.tsx`, Suspense, and streaming where slow work benefits from progressive rendering;
- `error.tsx` boundaries where failure isolation is useful;
- `not-found.tsx` where missing resources need route-specific handling;
- `next/image` for normal application image rendering where applicable;
- `next/font` for font loading;
- metadata for meaningful public/indexable pages.

### Rendering strategy

Choose rendering based on data behavior, not dogma.

**Static/SSG** is appropriate for public pages whose content does not depend on the current user/request.

**ISR/revalidation** is appropriate when a page can be served statically while accepting controlled freshness.

**Dynamic rendering** is appropriate when output genuinely depends on request-time data such as authenticated identity, cookies, or other request-specific state.

Do not force the landing page to be static if its content genuinely requires per-request authentication state. Prefer separating public marketing content from small client-side/authenticated UI where that achieves the desired architecture.

Do not claim a page is SSG/SSR/dynamic solely from intuition; inspect the code and, when practical, verify with a production build.

### Loading/error boundaries

Do not require every route to have `loading.tsx` or `error.tsx`.
Instead ask:
- Is there a meaningful slow async operation?
- Would streaming improve perceived performance?
- Would a local failure boundary preserve unrelated dashboard functionality?

### Metadata/SEO

Treat missing titles/descriptions on important public pages as a concrete Next.js quality gap when the lesson/project expects them.
Sitemap, robots, structured data, and similar search-engine features are production recommendations unless specifically required by UMA scope.

## E. SDLC

Use the six phases as a lifecycle, not a one-time checklist:
1. Planning
2. Requirements
3. Design
4. Implementation
5. Testing
6. Deployment/Maintenance

UMA is currently in active implementation/hardening.

Testing work should prioritize real system risks:
- order state transitions;
- checkout;
- inventory/stock correctness;
- authorization/RLS;
- integrations between modules;
- important validation and error paths.

Deployment/maintenance work should include meaningful monitoring and operational checks.
A health endpoint that only returns process liveness is not evidence that the database/integrations are healthy.

CI is a strong recommended practice because automation should follow the pattern:
**trigger → execute → verify**.

## F. Integrative Programming / Integration

Treat integration as controlled information flow among independently developed components.

Audit:
- Clerk ↔ application authentication;
- Clerk webhook ↔ profile synchronization;
- Next.js ↔ Supabase;
- Supabase Realtime ↔ UI;
- Supabase Storage ↔ uploads;
- future external services/API integrations.

Check:
- authentication/signature verification;
- clear data contracts;
- failure handling;
- retries/idempotency where repeated events are possible;
- no secret exposure;
- graceful behavior when an external dependency is unavailable.

Do not require AI, payments, SMS/email, public partner APIs, i18n, PWA/offline support, or other integrations unless they are part of an explicit UMA requirement or selected future scope.

---

# Audit Workflow

When asked to “audit UMA,” “review against the lessons,” or “what is next?” follow this order:

## Step 1 — Establish baseline

Inspect:
- package scripts;
- git status/diff;
- route structure;
- auth/proxy;
- data/query layer;
- actions/route handlers;
- database schema/migrations if available;
- tests and verification scripts;
- loading/error/not-found files;
- metadata/robots/sitemap files.

Run safe verification commands when appropriate:
- lint;
- typecheck;
- tests;
- build;
- existing verify scripts.

Record what was actually run.

## Step 2 — Map findings

For each finding, record:

`ID | Area | Evidence | Status | Class | Impact | Smallest sensible fix`

Example:

`CRUD-04 | pickup_date | server saves field; buyer UI has no input | CODE-REVIEWED | REQUIRED | incomplete requirement lifecycle | add checkout input + read display + permitted update`

## Step 3 — Prioritize

Use:

**P0 — correctness/security**
- authorization;
- IDOR;
- RLS;
- stock races;
- destructive data bugs;
- broken order transitions;
- secret exposure.

**P1 — lesson compliance**
- incomplete CRUD;
- meaningful MVC leakage;
- serious client/server boundary problems;
- missing core testing;
- missing pagination on obviously unbounded data.

**P2 — performance/UX**
- rendering strategy;
- Suspense/loading;
- error isolation;
- query precision;
- image/font optimization;
- metadata.

**P3 — production/future enhancements**
- monitoring vendors;
- sitemap;
- notifications;
- i18n;
- PWA;
- public partner API;
- AI;
- payments.

## Step 4 — Implement in slices

Make one coherent slice at a time.
After each slice:
1. run relevant checks;
2. inspect the diff;
3. confirm no unrelated behavior changed;
4. update project progress documentation if that is the project convention.

## Step 5 — Report accurately

End with:
- what was changed;
- what was verified;
- what remains code-reviewed/unverified;
- next highest-value slice.

Never claim “fully compliant” unless the evidence supports it.

---

# Specific UMA Backlog From the Current Audit

Use this as a starting point, not an immutable roadmap.

### High priority
1. Add CI for lint/typecheck/build and existing verification scripts.
2. Add automated tests for checkout, order state transitions, and inventory correctness.
3. Complete `pickup_date` lifecycle if it remains an approved requirement.
4. Review MVC leakage from Actions/Views into direct database access.
5. Add pagination to unbounded order/message/admin lists where actual usage warrants it.
6. Replace unnecessary `SELECT *` with explicit projections where result shapes are known.

### Next.js/quality hardening
7. Review public landing-page rendering strategy and authenticated UI separation.
8. Add useful loading/Suspense boundaries to genuinely slow public/dashboard sections.
9. Add nested error boundaries where local failure isolation matters.
10. Complete meaningful page metadata.
11. Verify image handling and replace ordinary raw `<img>` usage with `next/image` where appropriate.

### Operations
12. Improve `/api/health` to check critical dependencies when appropriate.
13. Add error monitoring after the core test/CI foundation is stable.
14. Document database delete behavior where foreign-key policy is ambiguous.

### Future scope — only with explicit approval
15. Notifications.
16. Payments.
17. i18n/Bisaya or Filipino language support.
18. PWA/offline behavior.
19. Public partner API.
20. AI features.

---

# Anti-Patterns

Do not:
- refactor working code solely to make file organization look more “enterprise”;
- add a service layer for every single database call;
- add `loading.tsx` everywhere just to increase the file count;
- add tests that only test framework behavior rather than UMA behavior;
- add AI because it sounds impressive;
- add public APIs before there is a real consumer;
- make the landing page dynamically rendered merely because auth exists somewhere in the application;
- call code-review guesses “verified”;
- expand scope during a hardening task without explicit justification;
- remove working security constraints/RLS to simplify development.

# Definition of Done for a Hardening Slice

A slice is done when:
- the intended requirement is clear;
- the smallest sensible implementation is complete;
- relevant tests/checks pass;
- the code respects the appropriate architecture boundary;
- no new obvious security or data-integrity regression is introduced;
- the result is documented accurately as verified, code-reviewed, or unverified.
