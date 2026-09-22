---
name: product-thinking
description: Product thinking, UX architecture, scope discipline, role modeling, and build discipline for UMA Market.
---

# SKILLS.md
# Product Thinking, UX, Architecture & Build Discipline

> A reusable operating skill for Claude, Gemini, Antigravity, and other coding/product agents.
>
> Purpose: build systems that are **clear enough to understand, deep enough to feel real, polished enough to present, and disciplined enough to finish**.

---

## 0. CORE PRINCIPLE

Do not optimize for the number of features, pages, technologies, or lines of code.

Optimize for:

**Problem relevance + user value + coherent workflow + technical feasibility + visual quality + finishability.**

The target is not:

- a giant enterprise platform
- a generic CRUD application
- a pretty landing page with weak system logic
- a feature dump
- an overengineered architecture

The target is:

> **A coherent product that solves the right problem exceptionally well within a realistic scope.**

Use this mental model throughout the project:

```text
REAL PROBLEM
    ↓
TARGET USERS
    ↓
CORE VALUE
    ↓
CORE WORKFLOW
    ↓
SYSTEM MODEL
    ↓
UX / INFORMATION ARCHITECTURE
    ↓
UI / DESIGN SYSTEM
    ↓
TECHNICAL IMPLEMENTATION
    ↓
TESTING / POLISH
```

Never reverse this order unnecessarily.

---

# 1. THINK LIKE A PRODUCT STRATEGIST FIRST

Before adding features or writing pages, determine:

1. What real problem exists?
2. Who experiences it?
3. What are they trying to accomplish?
4. What makes the current process difficult?
5. Where can software meaningfully reduce friction?
6. What is outside the product's responsibility?

Do not invent a problem to justify a feature.

Do not add functionality simply because it sounds impressive.

If the problem cannot be explained in one or two clear sentences, keep investigating and simplify the framing.

### Problem Quality Test

A useful problem statement should answer:

- **Who?**
- **What problem?**
- **Where / in what context?**
- **Why does it matter?**
- **How could the system improve it?**

For location-based academic projects, prefer real local evidence over generic national assumptions.

---

# 2. DEFINE ONE CORE VALUE PROPOSITION

Every product should answer one simple question:

> **What does this system make easier?**

Write one sentence.

Then reduce the product to its fundamental transformation.

Examples:

```text
Need something done
→ Find someone
→ Book
→ Get it done
```

```text
Farmer has supply
→ Business has demand
→ Connect
→ Order
→ Fulfill
```

This is the product's backbone.

If a feature does not strengthen this backbone, challenge whether it belongs in the MVP.

---

# 3. FIND THE PRODUCT'S “ONE THING”

Strong products usually have one memorable mechanism.

Examples:

- marketplace → matching / discovery
- booking platform → booking lifecycle
- inventory system → stock accuracy
- procurement system → supply-demand coordination
- school system → workflow completion
- publication tracker → assignment and status visibility

Identify that mechanism explicitly.

Then make it excellent.

Do not bury the core mechanism under secondary features.

---

# 4. DESIGN AROUND USER JOBS, NOT DATABASE TABLES

Do not begin with:

> “We have Users, Products, Orders, Categories, Messages...”

and then turn every table into a page.

Begin with:

> “What is this person trying to get done?”

For every user role, ask:

### What do they need to know?
### What do they need to decide?
### What do they need to do?
### What happens next?

The interface should be shaped around those answers.

---

# 5. MAP THE CORE USER JOURNEY BEFORE BUILDING UI

For each major role, document the primary workflow.

Use:

```text
Entry
  ↓
Discovery
  ↓
Decision
  ↓
Action
  ↓
Processing
  ↓
Status
  ↓
Completion
  ↓
Feedback / History
```

Example:

```text
Home
 ↓
Search / Browse
 ↓
Select item/provider
 ↓
Configure request
 ↓
Confirm
 ↓
Track
 ↓
Complete
 ↓
Review / History
```

Every major screen should have a reason to exist within a workflow.

If a screen has no meaningful job, question it.

---

# 6. SCOPE DISCIPLINE

Use three levels for every feature.

## A. MVP
Required to prove that the core product works.

## B. Enhancement
Adds meaningful value after the core workflow is stable.

## C. Future
Interesting, scalable, advanced, or integration-heavy functionality that should not block MVP completion.

Example:

```text
MVP
- authentication
- profiles
- core records
- search / discovery
- main transaction
- status tracking
- admin control

Enhancement
- notifications
- ratings
- saved items
- richer analytics

Future
- advanced AI
- route optimization
- payment integrations
- forecasting
- external integrations
```

### Scope Rule

> **Build the smallest system that completely demonstrates the core problem-solution loop.**

Do not confuse scope with ambition.

A focused project can still be sophisticated.

---

# 7. SIMPLE ≠ BASIC

The goal is:

> **Simple to understand + deep enough to be believable.**

Good products hide complexity instead of exposing it everywhere.

For example, a delivery system may internally manage many states but show users:

```text
Placed → Accepted → Preparing → In Transit → Completed
```

Do not remove useful complexity merely to look minimal.

Instead, place complexity where it belongs:

- user interface → simple
- business rules → explicit
- backend → robust
- admin tools → operationally useful

---

# 8. APPLY A “WHY DOES THIS EXIST?” TEST

Before implementing any new feature, answer:

1. What user problem does this solve?
2. Which step of the core workflow does it improve?
3. Is the problem real or merely assumed?
4. Is there a simpler way to solve it?
5. Does it increase scope significantly?
6. Does the project have time to support it properly?

If the answers are weak, defer or remove the feature.

---

# 9. USE PROGRESSIVE COMPLEXITY

Do not expose every capability at once.

A useful hierarchy is:

### Level 1 — Essential
What the user needs immediately.

### Level 2 — Supporting
What they may need during the workflow.

### Level 3 — Advanced
Analytics, configuration, history, and secondary actions.

### Level 4 — Administrative
Moderation, audit, operations, reporting, and controls.

Keep advanced complexity out of the main path unless it is necessary.

---

# 10. ROLE & AUTHENTICATION ARCHITECTURE

UMA uses one unified authentication system.

## Authentication

There must be ONE authentication entry point for the entire platform.

Do NOT create separate login portals for:

- Farmers
- Business Buyers
- Administrators

Use one unified:

- Sign In
- Sign Up
- Authentication flow

After authentication, the system determines the user's role and
provides the appropriate experience.

Authentication is handled by Clerk.

Application data and authorization-aware records are stored in Supabase.

Do not implement a second competing authentication system.

---

## Role Model

UMA has three primary roles:

### Farmer

Primary goal:

**Manage supply → receive orders → fulfill orders**

Typical experience:

- Farmer dashboard
- My Products
- Availability
- Orders
- Order details
- Messages
- Profile

### Business Buyer

Primary goal:

**Discover supply → order/request → track fulfillment**

Typical experience:

- Business dashboard
- Products
- Product details
- Cart / order
- Orders
- Order tracking
- Messages
- Profile

### Admin

Primary goal:

**Verify → monitor → resolve → report**

Typical experience:

- Admin dashboard
- Farmer management
- Business management
- Product moderation
- Order monitoring
- Verification
- Reports
- Activity logs

---

## Role Routing

After authentication:

```text
Authenticated User
       ↓
Determine Role
       ↓
 ┌─────┼─────┐
 ↓     ↓     ↓
Farmer Business Admin
 ↓     ↓     ↓
Farmer Business Admin
Dashboard Dashboard Dashboard

---

# 11. INFORMATION ARCHITECTURE BEFORE VISUAL POLISH

Before spending time on gradients, animations, icons, or decorative layouts, establish:

- navigation
- routes
- page hierarchy
- terminology
- primary actions
- data relationships
- states
- empty states
- error states
- loading states

A beautiful interface with a weak information architecture is still a weak product.

---

# 12. LANDING PAGE PRINCIPLES

A landing page should explain the product quickly, not display every feature.

Preferred structure:

```text
Hero
 ↓
Problem
 ↓
How it works
 ↓
Core product preview
 ↓
Who it is for
 ↓
Trust / impact / proof
 ↓
Final CTA
```

Usually 5–8 meaningful sections are enough.

Avoid:

- enormous hero sections with no product context
- repetitive feature grids
- fake statistics
- endless testimonials
- generic “revolutionize” language
- excessive animations
- paragraphs explaining everything

Show the product whenever possible.

---

# 13. MOBILE IS A FIRST-CLASS EXPERIENCE

Do not simply shrink desktop layouts.

Mobile should prioritize:

- primary action
- search / discovery
- status
- next step
- thumb-friendly controls
- bottom navigation where appropriate

A good mobile home screen usually answers:

> “What can I do right now?”

Avoid turning mobile dashboards into dense desktop dashboards.

---

# 14. DESIGN SYSTEM DISCIPLINE

Define before scaling screens:

### Typography
Prefer one main type family, with deliberate hierarchy.

### Color
Choose:

- primary
- secondary
- accent
- background
- surface
- text
- muted text
- semantic states

### Spacing
Use a consistent spacing system rather than arbitrary values everywhere.

### Radius
Choose a small family of radius values.

### Shadows
Use sparingly.

### Components
Build reusable primitives and patterns.

The objective is consistency, not maximum abstraction.

---

# 15. VISUAL DESIGN: NOT BASIC, NOT OVERDONE

Aim for:

- strong hierarchy
- intentional whitespace
- restrained color
- real imagery where appropriate
- consistent iconography
- clear CTA hierarchy
- balanced density
- visual rhythm
- subtle motion

Avoid:

- card soup
- gradient soup
- pill soup
- too many floating elements
- giant headings on every section
- every section using a different design trick
- random illustrations with no informational purpose
- excessive glassmorphism
- excessive shadows

### Rule

> **If every element tries to be special, nothing feels special.**

Use one strong visual idea per section.

---

# 16. BRANDING SHOULD COME FROM THE PRODUCT

Do not start with:

> “What logo looks cool?”

Start with:

> “What should the brand make people feel and understand?”

Define:

1. meaning
2. positioning
3. personality
4. visual concept
5. color logic
6. typography
7. tagline

Avoid generic category clichés.

For agriculture, for example, do not automatically default to:

**leaf + bright green + wheat icon.**

Instead identify the underlying concept:

**farm → supply → connection → market**.

---

# 17. LOCALIZATION WITHOUT MAKING A PRODUCT LOOK SMALL

When the product is designed for a specific city or community:

Use local context in:

- problem framing
- research
- examples
- content
- initial market scope

Do not necessarily put the city name into the brand.

A scalable pattern is:

```text
BRAND
A localized platform for [target city]
```

This makes the product feel real while preserving scalability.

---

# 18. GOVERNANCE SHOULD ONLY EXIST WHEN IT HAS A JOB

Do not add an LGU, government department, school office, manager, or moderator as a user just because a project requirement mentions governance.

Ask:

> **What specific coordination, accountability, verification, or reporting problem would this role solve?**

If no strong answer exists, keep the role out of the core MVP.

Governance can sometimes be handled through:

- platform admin
- verification
- audit trails
- role-based access
- controlled workflows
- reports

Do not manufacture organizational complexity.

---

# 19. TECH STACK SHOULD SERVE THE PRODUCT

When a preferred stack is specified, use it intentionally.

For example:

```text
Next.js
    ↓
Tailwind CSS
    ↓
shadcn/ui
    ↓
Clerk
    ↓
Supabase
```

Possible responsibility boundaries:

### Next.js
Application framework, routing, server/client architecture, actions/API where appropriate.

### Tailwind
Styling system.

### shadcn/ui
Reusable UI primitives and consistent patterns.

### Clerk
Authentication, user identity, account/session management.

### Supabase
PostgreSQL database, storage, row-level security, and related backend capabilities where appropriate.

Do not introduce additional technologies unless they solve a real requirement.

---

# 20. ARCHITECTURE SHOULD BE BORING WHERE IT CAN BE BORING

Prefer:

- standard patterns
- predictable folder structure
- clear data ownership
- explicit validation
- reusable services
- simple database relationships
- understandable APIs

Avoid:

- abstraction for abstraction's sake
- unnecessary microservices
- duplicated state
- needless providers/contexts
- excessive generic wrappers
- libraries replacing a few lines of stable code

The best architecture is the one another developer can understand quickly.

---

# 21. DATABASE MODELING

Model the domain first.

Every table/entity should answer a real product need.

For each entity ask:

- What does it represent?
- Who owns it?
- What creates it?
- What changes it?
- What can delete/archive it?
- What other entities does it depend on?
- What information must be historically preserved?

Do not make the database more complicated than the domain requires.

---

# 22. BUSINESS RULES MUST BE EXPLICIT

Do not bury important logic inside random UI components.

Examples:

- who can create an order
- who can accept it
- when inventory decreases
- when status changes are allowed
- who can cancel
- when an order is considered complete
- what roles can see sensitive data

Make these rules deliberate and testable.

---

# 23. FULFILLMENT & LOGISTICS SCOPE

UMA MVP supports two fulfillment methods:

1. Pickup
2. Seller Delivery

Pickup allows the business buyer to collect the order from the farmer.

Seller Delivery allows the farmer/seller to deliver the order to the
business buyer.

The MVP does NOT include a dedicated courier/driver role, live GPS
tracking, automatic dispatch, route optimization, delivery bidding,
or Grab/Foodpanda-style logistics infrastructure.

Delivery in the MVP represents order fulfillment, not a standalone
courier marketplace.

Advanced logistics may be considered as a future enhancement.

# 24. AUTHORIZATION IS NOT JUST UI HIDING

Do not rely on:

```text
if role === "admin" then hide button
```

as your security model.

Enforce authorization on the server/database layer where appropriate.

UI restrictions improve UX.

Server/database rules protect the system.

---


# 25. SECURITY AND DATA HANDLING

Treat authentication, authorization, uploads, secrets, and user data as real concerns.

Never:

- hardcode secrets
- expose private keys
- trust client-provided roles
- accept arbitrary file types without validation
- trust client-side ownership checks
- log sensitive information unnecessarily

Use environment variables and server-side validation.

For academic prototypes, clearly separate simulated functionality from real integrations.

---

# 26. REALISTIC PROTOTYPE VS FAKE FUNCTIONALITY

A prototype should feel complete, but do not falsely imply external systems exist when they do not.

Examples:

If payment is not actually integrated:

```text
Payment method: Cash on Delivery
```

rather than pretending a real transaction was charged.

If delivery routing is simulated:

```text
Estimated delivery window
```

rather than inventing real-time traffic or courier telemetry.

Build believable flows without fabricating capabilities.

---

# 27. STATES ARE PART OF THE PRODUCT

Do not design only the happy path.

Every important workflow should consider:

- loading
- empty
- success
- error
- validation error
- unavailable
- canceled
- expired
- unauthorized
- forbidden
- offline / retry where relevant

Examples:

```text
No products yet
No active orders
Order canceled
Verification pending
Payment unavailable
Could not save changes
```

Empty and error states should guide the user toward the next useful action.

---

# 28. BUTTONS MUST MEAN SOMETHING

Do not create dead primary buttons.

Every important CTA should either:

- navigate
- submit
- mutate data
- open a meaningful flow
- clearly explain why it cannot proceed

A polished prototype should not contain fake interactions on its critical journey.

---

# 29. BUILD IN SLICES, NOT BY RANDOM PAGE ORDER

Prefer vertical slices.

Example:

### Slice 1
Authentication → role selection → basic dashboard.

### Slice 2
Create record → view record → edit record.

### Slice 3
Transaction → status lifecycle → completion.

### Slice 4
Admin monitoring → moderation → reports.

Then polish.

This produces working product behavior early.

---

# 30. WORKING-CODE PRESERVATION

Before modifying existing code:

1. inspect it
2. understand it
3. identify what already works
4. preserve useful infrastructure
5. make the smallest reasonable change
6. test after the change

Do not rewrite an entire project merely because a cleaner architecture is theoretically possible.

Avoid destructive “start from scratch” behavior unless the current architecture truly blocks progress.

---

# 31. WHEN SOMETHING IS AMBIGUOUS

Do not repeatedly interrupt the user for small decisions.

Use this hierarchy:

1. explicit user requirement
2. established project conventions
3. existing design system
4. core user need
5. simplest professional solution
6. safest implementation

Choose the most coherent option and continue.

Ask the user only when the decision materially changes:

- project scope
- business logic
- data model
- external commitments
- security
- irreversible behavior

---

# 32. CHALLENGE BAD IDEAS CONSTRUCTIVELY

Do not blindly agree with the project owner.

When an idea is:

- unnecessary
- redundant
- too broad
- technically risky
- inconsistent with the product
- difficult to defend academically
- visually excessive

say so clearly.

Then give a better alternative.

Use this structure:

```text
Current idea
→ Why it is weak / risky
→ Better direction
→ What to build instead
```

Never criticize without moving the project forward.

---

# 33. ACADEMIC PROJECT MODE

When a system is for a school project, evaluate it using:

### Problem
Is the problem specific and defensible?

### Users
Are the stakeholders identifiable?

### Objectives
Can the objectives be demonstrated?

### Scope
Can students realistically build it?

### Technology
Can the chosen stack be justified?

### Contribution
Does the system improve a real process?

### Demonstration
Can the panel see a complete working workflow?

Do not add complexity merely to make the proposal sound academic.

A focused system with clear objectives is easier to defend than a huge system with vague objectives.

---

# 34. LOCAL PROBLEM RESEARCH

When a project claims to solve a local problem:

- verify local facts
- identify existing programs/services
- identify similar systems
- distinguish the proposed system from existing solutions
- avoid claiming to replace organizations without evidence

If something cannot be verified, state that it cannot be confirmed.

Do not fabricate local statistics, stakeholder behavior, or institutional processes.

---

# 35. COMPETITOR / EXISTING-SYSTEM THINKING

Before positioning a product as new, ask:

- Does a similar product already exist?
- What does it solve?
- Where does it operate?
- What is its core workflow?
- What gap remains?

Do not define differentiation as:

> “Our interface looks better.”

Prefer differentiation based on:

- target users
- workflow
- local context
- information advantage
- coordination mechanism
- operational model

---

# 36. FEATURE PRIORITIZATION

When there are too many ideas, use this order:

### Must solve the core problem
Build now.

### Makes the core workflow significantly better
Build after the core works.

### Nice to have
Only build if there is time.

### Sounds impressive but weakly justified
Do not build.

A feature should earn its complexity.

---

# 37. USE REALISTIC CONTENT

Do not fill a product with obviously fake filler.

Prefer realistic:

- names
- product/service descriptions
- statuses
- dates
- quantities
- categories
- prices
- notifications
- empty states

When data is mock data, keep it internally consistent.

Example:

If a farmer has 120 kg available and a business orders 20 kg, the remaining available quantity should become 100 kg in the prototype state.

Believability comes from consistency.

---

# 38. ANALYTICS SHOULD ANSWER QUESTIONS

Do not add charts because dashboards “look professional.”

Every metric should answer a question.

Examples:

- How many active orders exist?
- Which products have the highest demand?
- Which orders are delayed?
- How much inventory is available?
- Which tasks are incomplete?

Prefer a few decision-useful metrics over ten decorative metrics.

---

# 39. ADMIN PANELS SHOULD BE OPERATIONAL, NOT DECORATIVE

Admin should help someone:

- see what needs attention
- take action
- investigate issues
- manage records
- generate useful reports

Do not make admin dashboards giant analytics galleries with no workflow.

A useful admin dashboard answers:

> **What needs my attention right now?**

---

# 40. RESPONSIVE DESIGN IS INTENTIONAL

Test at realistic widths.

At minimum consider:

- 320px
- 360px
- 390px
- 430px
- tablet
- 1024px
- 1280px
- 1440px
- 1920px

Do not merely make elements smaller.

Reconsider layout hierarchy at different widths.

---

# 41. ACCESSIBILITY BASICS

Ensure:

- sufficient contrast
- visible focus states
- semantic HTML
- keyboard navigation where relevant
- labels for inputs
- meaningful button text
- alt text for informative images
- motion that is not required for comprehension

Accessibility is part of product quality.

---

# 42. PERFORMANCE BASICS

Prefer:

- optimized images
- sensible component boundaries
- server rendering where appropriate
- lazy loading where useful
- minimal client-side JavaScript when possible
- efficient queries
- avoiding unnecessary rerenders

Do not optimize blindly.

Measure or identify an actual problem first when possible.

---

# 43. QA MENTALITY

Before calling a system complete, manually inspect:

### Product
- core user journey
- each role
- create/edit/delete flows
- transaction lifecycle
- permissions

### UX
- navigation
- next actions
- empty states
- errors
- confirmation

### UI
- spacing
- typography
- color
- responsive behavior
- component consistency

### Technical
- broken routes
- console errors
- failed network requests
- validation
- authorization
- data persistence

### Presentation
- does someone unfamiliar understand the product?
- does the demo tell a coherent story?
- does the feature set support the stated problem?

Fix issues instead of merely reporting them.

---

# 44. PRESENTATION TEST

A person seeing the product for the first time should quickly understand:

1. What is this?
2. Who is it for?
3. What problem does it solve?
4. What do I do first?
5. What happens after I act?
6. What makes the workflow useful?

If those answers are unclear, simplify the product communication.

---

# 45. DEMO STORY

For an academic or stakeholder presentation, demonstrate one complete story instead of showing disconnected pages.

Use:

```text
Problem
 ↓
User enters system
 ↓
User performs key action
 ↓
Another role receives result
 ↓
System changes state
 ↓
Process completes
 ↓
Admin / report shows outcome
```

A complete story proves more than showing twenty screens.

---

# 46. IMPLEMENTATION ORDER

Preferred sequence:

```text
1. Audit existing project
2. Understand requirements
3. Define product model
4. Define user roles
5. Define core workflows
6. Define information architecture
7. Define design system
8. Build reusable primitives
9. Build core vertical slices
10. Connect real data
11. Add supporting features
12. Add edge states
13. Responsive pass
14. QA pass
15. Visual polish
16. Final presentation pass
```

Do not spend days polishing a homepage while the core system flow is still fake.

---

# 47. AUTONOMOUS AGENT BEHAVIOR

Operate as a proactive product-building agent.

When instructions are clear:

- inspect
- decide
- implement
- test
- improve

Do not continuously request permission for ordinary implementation choices.

When a choice is not specified, choose the simplest coherent professional option.

Maintain consistency across the project.

Document meaningful architectural decisions.

---

# 48. DO NOT STOP AFTER ONE PAGE

A project is not complete because the landing page looks good.

Build the actual product experience.

At minimum, connect the main flow end-to-end before declaring success.

Example:

```text
Landing
→ Auth
→ Dashboard
→ Main action
→ Detail
→ Transaction
→ Status
→ Completion
```

The primary buttons must work.

---

# 49. DO NOT DESTROY WORK

Before every major refactor:

> **Is this actually necessary?**

If the existing implementation already solves the problem correctly, preserve it.

Improve incrementally.

Do not replace working code merely for stylistic preference.

---

# 50. OUTPUT QUALITY BAR

The finished project should feel:

- useful
- intentional
- believable
- modern
- local when appropriate
- simple
- coherent
- polished
- technically credible
- academically defensible

It should NOT feel:

- generic
- bloated
- unfinished
- over-animated
- over-engineered
- like a template
- like disconnected CRUD pages

---

# 51. FINAL DECISION FRAMEWORK

When deciding between multiple approaches, evaluate each against:

```text
1. Does it solve the actual problem?
2. Does it improve the core user journey?
3. Is it understandable?
4. Is it realistically buildable?
5. Does it fit the existing architecture?
6. Does it reduce or increase unnecessary scope?
7. Is it defensible to a reviewer or academic panel?
8. Will the user actually benefit from it?
```

Choose the approach with the strongest overall coherence, not the most impressive feature list.

---

# 52. THE “NOT BASIC, NOT TOO MUCH” RULE

Whenever designing a system, aim for this exact middle:

```text
                 TOO BASIC
                     │
                     │
             CRUD + generic UI
                     │
                     ▼
        ┌─────────────────────────┐
        │                         │
        │    IDEAL PRODUCT        │
        │                         │
        │  clear + useful +       │
        │  polished + realistic   │
        │  + appropriately deep   │
        │                         │
        └─────────────────────────┘
                     ▲
                     │
              bloated system
                     │
                     │
               TOO MUCH
```

The ideal system has enough depth to demonstrate thoughtful product design, but not so much complexity that the core purpose becomes difficult to explain.

---

# 53. THE “ONE SENTENCE” TEST

At any point, be able to finish this sentence:

> **“This system helps [USER] do [IMPORTANT JOB] by [CORE MECHANISM].”**

If the sentence changes constantly as features are added, the project is probably drifting.

Return to the core problem.

---

# 54. THE “REMOVE 20%” TEST

When the system starts feeling crowded:

- remove duplicate features
- remove decorative UI
- remove redundant navigation
- remove low-value analytics
- remove secondary workflows

A good product often becomes stronger when unnecessary complexity is removed.

Do not remove the core mechanism.

---

# 55. THE “WOULD A REAL PERSON USE THIS?” TEST

Before implementing a feature, ask:

> If this were a real product tomorrow, would a real user understand why this exists and use it?

If the answer is unclear, investigate or defer it.

---

# 56. THE “ACADEMIC PANEL” TEST

Before finalizing the project, imagine a reviewer asks:

> Why does this feature exist?

The answer should point to:

- a real problem
- a user need
- a system requirement
- a business rule
- a usability need

Not:

> “Because it looks cool.”

---

# 57. THE “REAL PRODUCT” TEST

Before finalizing, ask whether the system could plausibly be shown to:

- a customer
- a stakeholder
- a product designer
- a developer
- a business owner
- an academic panel

without needing to apologize for obvious gaps in the core experience.

---

# 58. FINAL PHILOSOPHY

> **Do not build the biggest thing you can imagine. Build the clearest thing that solves the right problem.**

> **Do not make the product simple by removing depth. Make it simple by putting complexity in the right place.**

> **Do not use features to impress people. Use product decisions to convince them.**

> **Do not polish the surface until the workflow underneath makes sense.**

> **Do not confuse more with better. Coherence wins.**

---

# 59. FINAL AGENT DIRECTIVE

Before every major implementation decision, silently ask:

```text
What problem am I solving?
Who am I solving it for?
What is the simplest professional solution?
Does it strengthen the core workflow?
Can we realistically build and support it?
What can be removed?
What would a real user expect?
What would a reviewer challenge?
```

Then act.

Do not merely report what should be done.

**Inspect the project. Make the decision. Implement the solution. Test it. Improve it.**

The final standard is:

> **Simple enough to understand quickly. Deep enough to prove it was thoughtfully designed. Polished enough to feel real. Focused enough to actually finish.**
