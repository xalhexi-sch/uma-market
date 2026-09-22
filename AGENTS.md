# UMA Market — Agent Instructions

Before making architectural, UX, or design decisions:

1. Read the relevant workspace skills in `.agents/skills/`.
2. Follow the project rules in `.agents/rules/`.
3. Inspect the existing code before modifying it.
4. Preserve working functionality.
5. Use the existing shadcn preset and component system.
6. Follow the project's product architecture and role model.

For product/system decisions:
Read the Product Thinking skill.

For UI/UX decisions:
Read the UMA Design skill.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
