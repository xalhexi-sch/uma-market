---
name: uma-design
description: Product UI/UX and visual design skill for UMA Market with shadcn-first principles, visual tokens, and restrained natural aesthetics.
---

# DESIGN_SKILL.md
# Product UI/UX & Visual Design Skill — UMA / shadcn-first

## PURPOSE

Act as the product designer, UX architect, visual designer, interaction designer, and design-system lead for this project.

Your job is not to decorate pages.

Your job is to create interfaces that feel:

- modern
- minimal
- useful
- trustworthy
- premium
- calm
- intentional
- easy to understand
- realistic enough to ship

The design should feel like a real product, not a school-project dashboard.

The target quality is:

> **Not basic. Not bloated. Not generic.**

Think:

**clear hierarchy + restrained visual language + purposeful information + excellent interaction design.**

---

# 1. DESIGN NORTH STAR

Every design decision should support the product's core job.

For UMA Market:

> **Connect local agricultural supply with business demand.**

The interface should make the following feel effortless:

**Discover → Understand → Decide → Order → Track → Complete**

Do not let branding, animation, charts, cards, or decorative sections compete with that workflow.

---

# 2. THE THREE DESIGN TESTS

Before adding a section, card, component, animation, illustration, or interaction, ask:

### Test A — Purpose

What job does this element perform?

### Test B — Hierarchy

Why does the user need to see it here?

### Test C — Removal

Would the page become worse without it?

If the answer to C is no, remove it.

Use this aggressively.

A polished interface is usually created through subtraction.

---

# 3. SIMPLE DOES NOT MEAN EMPTY

Do not confuse minimalist design with removing useful information.

The goal is:

> **Low visual noise, high information value.**

A page can contain substantial information while still feeling minimal.

Use:

- whitespace
- typography
- alignment
- grouping
- subtle borders
- restrained surfaces
- clear primary actions

to create hierarchy instead of relying on decoration.

---

# 4. SHADCN-FIRST DESIGN RULE

Use shadcn/ui as the primary UI foundation.

Do not recreate standard interface primitives from scratch when shadcn already provides an appropriate component.

Prefer composition of existing primitives.

Examples:

- Button
- Card
- Badge
- Input
- Label
- Select
- Command
- Dropdown Menu
- Sheet
- Dialog
- Drawer
- Tabs
- Table
- Data Table
- Sidebar
- Breadcrumb
- Calendar
- Date Picker
- Tooltip
- Popover
- Progress
- Skeleton
- Toast / Sonner
- Avatar
- Separator
- Scroll Area
- Pagination
- Accordion
- Collapsible

Current shadcn/ui provides a large composable component library and supports theme tokens and dark-mode variants. Use those patterns rather than inventing a parallel component system.

Do not duplicate a shadcn primitive under a different name unless there is a legitimate product-specific abstraction.

---

# 5. USE THE PROJECT'S SHADCN PRESET

This project uses:

`--preset b6F9M34Ou`

Treat the installed project preset as the visual baseline.

Do not casually replace the preset, reset the generated theme, or introduce a competing theme.

Inspect:

- components.json
- theme tokens
- existing component variants
- installed components
- icon library
- Tailwind configuration
- global styles

before making visual changes.

Preserve the preset unless a deliberate project-level design decision requires modification.

---

# 6. TOKEN-FIRST THEMING

Prefer semantic shadcn theme tokens instead of scattering hardcoded colors through components.

Use concepts such as:

- background
- foreground
- card
- card-foreground
- popover
- popover-foreground
- primary
- primary-foreground
- secondary
- secondary-foreground
- muted
- muted-foreground
- accent
- accent-foreground
- destructive
- border
- input
- ring

When implementing a new visual direction, modify theme tokens or reusable variants before adding one-off colors everywhere.

Prefer:

`bg-background`
`text-foreground`
`bg-primary`
`text-primary-foreground`
`border-border`
`text-muted-foreground`

over arbitrary hex values inside individual components.

---

# 7. UMA VISUAL LANGUAGE

The primary visual direction is:

## White + Green + Natural Imagery

The interface should feel:

**fresh, local, trustworthy, modern.**

The UI should not look like:

- a government portal
- a farming textbook
- a colorful grocery app
- a generic SaaS template

The desired feeling is closer to:

**modern commerce product + local agriculture + calm editorial design.**

---

# 8. COLOR STRATEGY

The default light experience should be predominantly white or near-white.

Green should communicate action, trust, and brand identity.

Use green primarily for:

- primary buttons
- active navigation
- selected states
- links when appropriate
- success/confirmation accents
- small brand details

Do not make the entire application green.

Recommended visual hierarchy:

### Surface
White / near-white

### Primary
Deep or medium green

### Secondary
Very light green / neutral

### Accent
Optional restrained harvest/gold accent

### Text
Near-black / charcoal

### Supporting text
Muted neutral

The green should feel intentional rather than decorative.

---

# 9. DARK MODE

Dark mode is supported by the shadcn theme system.

Dark mode is not a separate design.

It is the same hierarchy translated into darker surfaces.

Do not simply invert colors.

Verify:

- contrast
- button prominence
- border visibility
- disabled states
- muted text
- product images
- charts
- badges
- dialogs
- tables
- navigation
- empty states

Never create a dark-only visual component unless the product genuinely needs one.

---

# 10. TYPOGRAPHY

Use one primary modern sans-serif family unless the project already has a deliberate type system.

Typography should do most of the visual work.

Use hierarchy approximately like:

### Display
Very large, strong, short statement.

### Page title
Clear and direct.

### Section title
Strong but restrained.

### Body
Comfortable reading size and line height.

### Metadata
Small, muted, but still readable.

### Labels
Short and functional.

Avoid:

- too many font weights
- decorative typography everywhere
- uppercase text everywhere
- excessive letter spacing
- giant headlines on every screen

A strong headline should be memorable because of the words and hierarchy—not because it is enormous.

---

# 11. COPY IS PART OF DESIGN

Choose words intentionally.

Avoid generic SaaS copy such as:

- Empowering communities through innovation
- Revolutionizing agriculture
- Seamless solutions for everyone
- Your all-in-one platform
- Transforming the future

Prefer concrete language.

Examples for UMA:

### Hero

**Fresh from Butuan's farms to your business.**

### Supporting copy

**Source local produce, check availability, and manage orders in one place.**

### Product page

**Fresh tomatoes from a local farm, available for your next order.**

### Buyer CTA

**Explore Products**

### Farmer CTA

**Sell on UMA**

### Empty state

**No active orders yet.**

Copy should explain what happens, not merely sound inspirational.

---

# 12. LANDING PAGE DESIGN

The landing page should feel like a product brand site, not a marketing essay.

Recommended structure:

## 1. Navigation

- UMA Market logo
- Products
- For Farmers
- For Businesses
- About
- Sign In
- Get Started

Keep the header lightweight.

## 2. Hero

The hero must communicate:

**what UMA is + who it is for + what the user can do.**

Recommended composition:

Left:
- eyebrow
- strong headline
- supporting copy
- primary CTA
- secondary CTA

Right:
- one strong agricultural photograph
- very limited floating UI/product cards

Do not overload the image with badges.

## 3. Proof / value strip

A small row of 3–4 values:

- Local Produce
- Direct Connections
- Fair Opportunities
- Stronger Communities

Do not turn this into a statistics wall unless the values are backed by real data.

## 4. Featured Products

Show actual marketplace content.

Use product cards with:

- image
- product name
- price/unit
- availability
- source/farmer
- primary action

## 5. How UMA Works

Three steps only unless research demands more:

**Discover → Order → Fulfill**

## 6. Two-sided value proposition

One section for:

**For Farmers**

and one for:

**For Businesses**

Do not make this section huge.

## 7. Local impact

Explain the Butuan context briefly.

## 8. Final CTA

A strong, calm closing section.

Do not add unnecessary FAQ, newsletter, testimonial carousel, partner-logo wall, or ten repeated CTA sections unless the content has a real reason to exist.

---

# 13. LANDING PAGE IMAGE RULE

Use photography where it creates emotional or contextual understanding.

Strong locations for imagery:

- hero
- featured produce
- selected storytelling sections
- farmer/business split section

Do not fill every card with an image.

Imagery hierarchy:

**one hero image > supporting images > decorative images**

Use consistent crop ratios.

Do not mix random stock-photo styles.

For agriculture, prefer:

- real-looking farms
- local landscapes
- produce closeups
- farmers at work
- harvest scenes
- businesses receiving produce

Avoid over-staged corporate stock photography.

---

# 14. PRODUCT BROWSING PAGE

Use **Products** as the primary navigation label.

This is clearer than "Browse Products" as a page title.

"Browse Products" is appropriate for a button or CTA.

Recommended structure:

### Header

**Products**

Support text:

**Find fresh local produce available for your business.**

### Search

Large but restrained search input:

**Search products, farmers, or categories...**

### Filters

Use shadcn patterns such as:

- Select
- Popover
- Command
- Checkbox
- Sheet on mobile

Potential filters:

- category
- availability
- price range
- location
- farmer
- harvest date

Do not expose every filter immediately.

Progressive disclosure is preferred.

### Product grid

Desktop:
3–5 columns depending on width.

Mobile:
1–2 columns depending on card density.

Product cards should prioritize:

1. image
2. name
3. price
4. availability
5. source
6. action

Do not turn every product card into a mini-dashboard.

---

# 15. PRODUCT CARD RULE

A product card should answer:

> **What is this?**
> **How much is it?**
> **Is it available?**
> **Where does it come from?**
> **What can I do next?**

Example:

**Tomatoes**

`₱60 / kg`

`120 kg available`

`From Juan Dela Cruz Farm`

`Add to Cart`

Optional:
favorite button.

Do not add:

- long descriptions
- analytics
- ratings unless meaningful
- harvest story paragraphs
- delivery tracking
- multiple buttons
- ten metadata rows

Keep the card scannable.

---

# 16. PRODUCT DETAIL PAGE

This page should focus on decision-making.

Recommended hierarchy:

### Product image/gallery

### Product identity

**Tomatoes**

**₱60 / kg**

### Availability

**120 kg available**

### Source

**Juan Dela Cruz Farm**

### Useful attributes

- harvest date
- available until
- location
- minimum order if applicable

### Quantity selector

Use compact controls.

### Primary CTA

**Add to Cart**

### Secondary information

- About
- Availability
- Fulfillment details

Use Tabs only if there is enough distinct content to justify them.

Do not use Tabs just because the component exists.

---

# 17. BUSINESS DASHBOARD

The dashboard should not try to show everything.

Its job is to answer:

> **What do I need to know right now?**

Top:

**Good morning, Nas.**

Supporting line:

**Source local. Support local. Grow together.**

Then a small number of useful metrics:

- Active Orders
- Pending Delivery
- Total Spend

Do not create twelve KPI cards.

Then:

### Recommended / Available Products

Product cards.

Then:

### Recent Orders

Use a compact table.

Then optionally:

### Quick action

**Browse Products**

The dashboard should feel like a calm workspace.

---

# 18. FARMER DASHBOARD

The farmer dashboard should be even simpler.

Priorities:

1. active supply
2. incoming orders
3. upcoming availability
4. recent activity

Useful sections:

- My Products
- Pending Orders
- Upcoming Harvest
- Recent Orders

Avoid complex financial analytics unless the project actually needs them.

---

# 19. MOBILE DESIGN

Mobile is not a compressed desktop.

Design specifically for touch.

Business mobile navigation can use:

**Home / Explore / Orders / Messages / Profile**

Farmer:

**Home / Products / Orders / Messages / Profile**

Keep bottom navigation compact.

Avoid more than 5 primary destinations.

---

# 20. MOBILE HOME

Recommended order:

1. greeting
2. search
3. product categories
4. available today
5. recent orders
6. useful shortcut

Do not place huge dashboards before the user's actual task.

Mobile should feel fast.

---

# 21. RESPONSIVE BEHAVIOR

Design deliberately for:

- 320px
- 360px
- 390px
- 430px
- 768px
- 1024px
- 1280px
- 1440px
- 1920px

When responsive:

- reduce columns
- change sidebars to Sheets where appropriate
- simplify filters
- collapse nonessential metadata
- preserve primary actions
- maintain readable type
- prevent horizontal scrolling
- avoid tiny controls

Do not merely shrink desktop layouts.

---

# 22. CARDS

Cards should group meaningful information.

Use cards for:

- products
- order summaries
- metric groups
- farmer/business profiles
- featured content

Do not put every section inside a Card.

A page containing twenty separate Card components usually feels fragmented.

Use plain layout sections when a card boundary adds no meaning.

---

# 23. BORDERS, SHADOWS, RADIUS

Prefer:

**subtle borders > heavy shadows**

Use elevation sparingly.

Keep radius consistent with the existing shadcn preset.

Do not randomly mix:

- square
- 4px
- 8px
- 16px
- 24px
- pill

Use a small set of consistent radii.

The visual language should feel cohesive.

---

# 24. ICONS

Use the project's configured icon library.

Icons should:

- reinforce meaning
- remain visually consistent
- use restrained sizing
- never replace important labels

Do not use icons as decoration everywhere.

Do not mix random icon families.

---

# 25. BUTTON HIERARCHY

Buttons should communicate priority.

### Primary
Green.

Use for the single most important action.

Examples:

**Explore Products**
**Add to Cart**
**Place Order**

### Secondary
Outline / neutral.

Examples:

**Sell on UMA**
**Learn More**

### Tertiary
Ghost / text.

Use for lower-priority actions.

Do not make every button green.

If everything is emphasized, nothing is emphasized.

---

# 26. TABLES

Use tables for operational information, not visual decoration.

Good uses:

- orders
- inventory
- users
- reports
- transactions

For mobile, transform dense tables into:

- stacked cards
- responsive rows
- horizontal scroll only when unavoidable

Do not force six-column desktop tables into 360px screens.

---

# 27. SEARCH UX

Search should feel like a primary product capability.

Use shadcn:

- Input
- Command
- Popover
- Badge
- Select

Search can support:

- product
- farmer
- category
- relevant keywords

Show useful empty states.

Example:

**No products found**

Try:
**"tomato", "vegetables", or "Juan Dela Cruz"**

Do not show a blank white screen.

---

# 28. FILTER UX

Desktop:

inline controls / Popover / Select

Mobile:

Sheet

Do not permanently occupy half the mobile screen with filters.

Remember:

> **Progressive disclosure.**

Show common filters first.

Move advanced filters behind "More filters".

---

# 29. FORMS

Forms should feel calm.

Group fields logically.

Example Add Product:

### Product information

Product
Category
Description

### Supply

Available quantity
Unit
Price
Harvest date
Availability end date

### Media

Product photo

### Publishing

Preview
Publish Product

Do not present twenty unrelated fields in one giant form.

Use shadcn:

- Label
- Input
- Textarea
- Select
- Checkbox
- Radio Group
- Calendar
- Date Picker
- Form patterns

---

# 30. MODALS / DIALOGS / SHEETS

Use Dialog for focused confirmation or small focused tasks.

Use Sheet for contextual side workflows and mobile filter/actions.

Use full pages for complex tasks.

Do not put an entire application inside a modal.

---

# 31. STATES ARE PART OF THE DESIGN

Every meaningful screen should consider:

### Loading
Use Skeleton.

### Empty
Explain what is missing and what to do.

### Error
Explain what happened and how to recover.

### Success
Confirm completion clearly.

### Disabled
Explain why an action is unavailable when necessary.

### Partial data
Do not break the entire layout if one field is missing.

A polished product is defined by its states, not only its ideal screenshot.

---

# 32. MICROINTERACTIONS

Use motion to communicate, not entertain.

Good:

- subtle hover
- pressed state
- loading
- page transitions
- toast confirmation
- selection state
- accordion motion
- sheet/dialog transitions

Avoid:

- constant floating animations
- excessive parallax
- huge entrance animations
- bouncing buttons
- decorative motion everywhere

Animation should disappear into the experience.

---

# 33. DASHBOARD ANALYTICS RULE

Only visualize information that helps a user make a decision.

Good:

**Active Orders**
**Pending Deliveries**
**Monthly Spend**
**Supply Availability**

Potentially useful:

- order trend
- most purchased products
- demand by category

Avoid decorative charts.

Do not add a chart simply because there is empty space.

---

# 34. INFORMATION DENSITY

Different screens deserve different density.

Landing page:
**low density**

Marketplace:
**medium density**

Product detail:
**medium density**

Dashboard:
**medium-high density**

Admin:
**high density**

Do not use the same spacing and card density everywhere.

---

# 35. ADMIN UI

Admin can be more information-dense than the public app.

Use:

- Sidebar
- Table
- Tabs
- Filters
- Dialog
- Sheet
- Breadcrumb
- Pagination
- Status badges

But keep it understandable.

Admin is an operational workspace, not the brand showcase.

---

# 36. BRANDING THROUGH UI

The product identity should come from:

- typography
- photography
- whitespace
- color restraint
- tone of copy
- consistent green actions
- agriculture imagery
- carefully designed data presentation

It should NOT depend on:

- giant logos
- constant leaf icons
- green gradients everywhere
- decorative wheat
- cartoon farmers

---

# 37. IMAGE PLACEMENT PRINCIPLE

Use images where the user benefits from seeing something.

### Strong

Product → see the product.

Farmer profile → see the farm/person when appropriate.

Hero → communicate place and atmosphere.

### Weak

Decorative image behind every card.

Every dashboard tile having an image.

Random stock photography between every section.

Always ask:

> **Does the image improve understanding or only fill space?**

---

# 38. CONTENT LENGTH

UI copy should be short.

Prefer:

**Fresh local produce. Ready for business.**

over a five-line paragraph.

Use long-form explanation on:

- About
- Help
- educational content
- detailed product information

Do not make every card verbose.

---

# 39. LANDING PAGE HEADLINE WRITING

Headlines should be:

- concrete
- memorable
- short
- product-relevant
- human

Strong patterns:

**Fresh from Butuan's farms to your business.**

**Source local. Buy with confidence.**

**Local harvest, ready for business.**

Avoid:

**Revolutionizing the future of agricultural commerce through digital innovation.**

---

# 40. EMPTY STATES

Do not use generic:

**Nothing here.**

Use useful language.

Orders:

**No active orders yet.**

**Your confirmed orders will appear here.**

CTA:
**Explore Products**

Farmer products:

**You haven't listed any products yet.**

CTA:
**Add Product**

Messages:

**No conversations yet.**

---

# 41. TRUST DESIGN

UMA operates between farmers and businesses.

Trust can be communicated visually through:

- verified badges
- clear source/farmer identity
- transparent pricing
- availability
- order status
- transaction history
- confirmation states

Do not solve every trust problem with a badge.

The workflow itself should create trust.

---

# 42. PRODUCT STATUS LANGUAGE

Use a clear status system.

Possible order states:

**Pending**
**Accepted**
**Preparing**
**Ready**
**For Delivery**
**Completed**
**Cancelled**

Avoid vague statuses such as:

- Processing-ish
- Almost Done
- On the Way Soon

Status labels should be predictable and consistent.

---

# 43. STATUS BADGES

Use semantic color sparingly.

Example:

- neutral → pending
- green → completed/success
- blue/secondary → active information
- amber → waiting/attention
- destructive → cancelled/problem

Do not create a rainbow interface.

---

# 44. DESIGN SYSTEM BEFORE PAGE-BY-PAGE CODING

Before implementing many screens, establish:

- type scale
- spacing rhythm
- color tokens
- button hierarchy
- card treatment
- radius
- navigation patterns
- product card pattern
- status badges
- forms
- table patterns
- responsive rules

Then compose pages from those patterns.

---

# 45. REUSABILITY

If two screens use the same pattern, share the component.

Examples:

- ProductCard
- ProductGrid
- OrderStatusBadge
- OrderSummary
- EmptyState
- SearchBar
- PageHeader
- StatCard
- FarmerAvatar
- AvailabilityBadge

But do not abstract every `<div>` into a component.

Abstract repeated meaning, not repeated HTML.

---

# 46. AVOID COMPONENT SOUP

Do not build:

`Card > CardHeader > CardContent > Flex > Stack > Wrapper > Box`

for every small section.

Compose shadcn primitives naturally.

Use semantic components where repetition or domain meaning exists.

---

# 47. DESIGN FOR REAL CONTENT

Do not design everything around perfect placeholder text.

Use realistic examples:

**Tomatoes**
**₱60 / kg**
**120 kg available**
**From Juan Dela Cruz Farm**

Design around:

- long farmer names
- long product names
- large quantities
- missing images
- no orders
- many orders
- zero results
- multiple categories

The UI must survive real content.

---

# 48. DO NOT FAKE SCALE

Do not create fake:

- 10,000 farmers
- 50,000 businesses
- millions in sales

just to make dashboards look impressive.

Use realistic demo data.

If statistics are not real, label them as demo/sample data or avoid them entirely.

---

# 49. DESIGN ACADEMICALLY, PRESENT PROFESSIONALLY

The interface should demonstrate system depth without exposing unnecessary complexity.

A professor should be able to see:

- real roles
- meaningful workflows
- operational states
- data relationships
- security
- responsive design
- usable interfaces

without seeing fifteen irrelevant modules.

---

# 50. FINAL DESIGN QUALITY CHECK

Before considering a page finished, ask:

### Product

Does the page serve a real user goal?

### Hierarchy

Can I tell what matters within two seconds?

### Copy

Do the words clearly explain the action?

### UI

Are shadcn components composed consistently?

### Theme

Does it work in light and dark mode?

### Responsive

Does it remain usable at mobile widths?

### States

What happens when there is no data?

### Interaction

What happens when the user clicks the primary action?

### Accessibility

Are labels, contrast, focus states, and keyboard interactions reasonable?

### Density

Is anything here unnecessary?

### Visual polish

Does spacing feel intentional?

### Consistency

Would this look like the same product as the other screens?

---

# 51. THE “ONE SCREEN AWAY” RULE

After completing a screen, imagine the user asking:

> **“Okay. What do I do next?”**

The interface should make the next step obvious.

Do not force the user to hunt for the continuation of the journey.

---

# 52. THE “SCREENSHOT TEST”

Every major page should look good in a static screenshot.

But do not optimize only for screenshots.

The screenshot must reflect a usable product.

A beautiful screenshot with broken UX is a failed design.

---

# 53. THE “NO DECORATION WITHOUT PURPOSE” RULE

Do not add visual elements because the page feels empty.

Instead ask:

**Does it need more information?**
**Does it need stronger hierarchy?**
**Does it need better imagery?**
**Does it need more whitespace?**

Sometimes an empty area is exactly what the design needs.

---

# 54. THE UMA PRODUCT EXPERIENCE

UMA should feel like:

**Fresh**
**Local**
**Trusted**
**Modern**
**Professional**
**Human**

A user should think:

> “This feels like a real marketplace.”

Not:

> “This is a school project about agriculture.”

---

# 55. RECOMMENDED UX VOCABULARY

Prefer:

### Navigation

**Products**
**Orders**
**Messages**
**Profile**

### Business CTAs

**Explore Products**
**Add to Cart**
**Place Order**
**View Order**

### Farmer CTAs

**Add Product**
**Manage Products**
**View Orders**

### Account

**Get Started**
**Sign In**

Avoid unnecessarily technical labels such as:

**Inventory Management Module**
**Transaction Monitoring**
**Procurement Repository**

Technical terminology belongs in admin/system documentation, not user-facing primary navigation.

---

# 56. BUILD ORDER

Design and implement in this order:

1. Design tokens / preset audit
2. Global layout
3. Navigation
4. Landing page
5. Products
6. Product detail
7. Business dashboard
8. Cart / order flow
9. Order tracking
10. Farmer dashboard
11. Farmer product management
12. Messages
13. Profile
14. Admin
15. Empty/loading/error states
16. Mobile refinement
17. Dark mode refinement
18. Visual polish

Do not polish page 1 while the core product flow is still broken.

---

# 57. DO NOT OVER-DESIGN

When unsure between:

**A. More visual elements**

and

**B. Better spacing and hierarchy**

prefer B.

When unsure between:

**A. More features**

and

**B. Better execution of the core workflow**

prefer B.

When unsure between:

**A. Custom component**

and

**B. Existing shadcn component**

prefer B unless a real product requirement justifies A.

---

# 58. FINAL DESIGN PHILOSOPHY

> **Make the interface feel obvious, not impressive.**

> **Use shadcn as the foundation, not a cage.**

> **Use branding to create identity, not decoration.**

> **Use imagery to create context, not filler.**

> **Use whitespace to create hierarchy, not emptiness.**

> **Use components to solve problems, not to prove how many components you know.**

> **Build something that looks simple because the thinking behind it is good.**

---

# 59. AGENT BEHAVIOR

When a design decision is unspecified:

1. Choose the most coherent professional solution.
2. Follow the existing design tokens.
3. Reuse shadcn components.
4. Prefer fewer visual patterns.
5. Preserve consistency.
6. Do not ask permission for obvious design decisions.
7. Do not introduce unnecessary libraries.
8. Do not rebuild standard primitives.
9. Explain major deviations from the design system.
10. Keep the product visually calm.

Before changing existing UI:

- inspect it
- understand it
- preserve good work
- improve incrementally
- avoid unnecessary rewrites

When implementation and visual quality conflict, fix the underlying structure rather than hiding the problem with decoration.

---

# 60. DEFINITION OF DONE

A screen is not finished merely because it renders.

It is finished when:

- the hierarchy is clear
- primary actions are obvious
- shadcn components are used correctly
- responsive behavior is intentional
- light mode works
- dark mode works
- loading state exists where needed
- empty state exists where needed
- error state exists where needed
- realistic data fits
- no major overflow exists
- navigation makes sense
- copy is clear
- visual language matches UMA
- it feels like the same product as every other screen
- the screen contributes to the core product workflow

FINAL RULE:

> **Do not build the most decorated interface you can. Build the clearest, most coherent interface you can.**
