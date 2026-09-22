# SKILLS INDEX

Use these files together.

## 1. SKILLS.md
Product thinking and system-design rules.

Covers:
- real problem
- value proposition
- users
- core workflow
- MVP scope
- technical feasibility
- academic defensibility
- feature discipline
- product decisions

## 2. DESIGN_SKILL.md
Visual design and UX rules.

Covers:
- shadcn-first UI
- UMA visual identity
- typography
- color strategy
- landing page composition
- product browsing
- dashboard design
- mobile UX
- responsive behavior
- states
- component composition
- imagery
- copy
- accessibility
- visual QA

## PRECEDENCE

When rules conflict:

1. Project-specific requirements
2. Existing working functionality and architecture
3. SKILLS.md — product/system decisions
4. DESIGN_SKILL.md — visual/UX decisions
5. Agent implementation preference

Do not break a product requirement merely to satisfy a visual preference.

Do not add visual complexity merely because a component exists.

## SHADCN

Use the project's existing shadcn configuration and preset.

Preset:
`--preset b6F9M34Ou`

Inspect the project's actual `components.json`, theme tokens, installed components, and icon library before implementation.

Use the official shadcn/ui skill when available in the environment, and layer this project's DESIGN_SKILL.md on top of it for UMA-specific visual direction.

## CORE PRINCIPLE

Product thinking determines:
**what should exist.**

Design thinking determines:
**how it should feel and how users should interact with it.**

Engineering determines:
**how it should be built reliably.**

Never reverse those priorities.
