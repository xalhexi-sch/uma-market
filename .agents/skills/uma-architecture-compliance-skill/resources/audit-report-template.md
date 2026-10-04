# UMA Market — Architecture Audit Report

## Verification baseline
- Date:
- Branch/commit:
- Commands actually run:
- Result:

## Findings

| ID | Area | Evidence | Status | Class | Impact | Smallest sensible fix |
|---|---|---|---|---|---|---|
| | | | VERIFIED / CODE-REVIEWED / UNVERIFIED | REQUIRED / RECOMMENDED / OPTIONAL | | |

## Lesson coverage

### Client–Server / 3-tier
- [ ] Client/application/database responsibilities are clear
- [ ] No inappropriate secret exposure
- [ ] Business-critical mutations are server-controlled

### MVC
- [ ] Model/data access is separated from Views
- [ ] Controllers/Actions orchestrate rather than duplicate model logic
- [ ] Legitimate realtime/browser exceptions are documented

### CRUD
- [ ] Requirements map to complete data lifecycles
- [ ] Reads use appropriate projections
- [ ] Updates/deletes are scoped safely
- [ ] Large collections are paginated when needed
- [ ] Referential integrity is enforced

### Next.js
- [ ] Rendering strategy matches data behavior
- [ ] Server/client boundaries are intentional
- [ ] Server Actions/Route Handlers are appropriate
- [ ] Suspense/loading used where useful
- [ ] Error boundaries isolate meaningful failures
- [ ] Metadata is present where appropriate
- [ ] Images/fonts use appropriate Next.js optimization

### SDLC
- [ ] Requirements are traceable
- [ ] Design decisions are documented
- [ ] Tests cover high-risk behavior
- [ ] Build/deploy verification exists
- [ ] Monitoring/maintenance plan exists

### Integration
- [ ] Auth/webhooks are validated
- [ ] Data contracts are clear
- [ ] Failure handling is intentional
- [ ] External services do not leak secrets

## Priority plan

### P0 — correctness/security

### P1 — lesson compliance

### P2 — performance/UX

### P3 — production/future enhancements

## Verification notes

State exactly what was run and what remains unverified.
