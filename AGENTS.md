# Project working instructions

Use the existing checkout: cloud tasks are already isolated; do not create Git worktrees unless requested. Read README.md, STATUS.md and docs/ADR-001.md before implementing the next work package. Historical handoff documents describe requirements, not verified implementation.

Keep Next.js standard App Router, npm exact dependencies and one lockfile. Do not install or build reference_partial_source. Use database transactions for domain + history + outbox and require expected_revision for updates. Validate session server-side and immutable owner ID; no client-controlled owner fields or gateway identity headers. Preserve unknown values and personal progress.

Never commit credentials, real tracker data, private operational records, CVs, .env files, or raw private handoff packages. Existing historical tracked documents may contain private context; stage changes selectively and do not push them automatically. Use synthetic fixtures only. Never print credential values.

Run lint, typecheck, unit/database tests, build and affected browser tests; distinguish synthetic Supabase transport from hosted live evidence. Update STATUS.md with actual commands and limitations. Do not claim Calendar/Telegram/restore readiness from a successful build. Scope is website plus read/draft-only agent; do not enable coding/terminal/Google/GitHub tools through Telegram. No production deployment, merge to main or destructive migration without explicit authorization.

## Supabase skills

Before Supabase work, read `.agents/skills/supabase/SKILL.md`; before database/schema/RLS work also read `.agents/skills/supabase-postgres-best-practices/SKILL.md` and relevant references. The official skills are copied locally and pinned by skills-lock.json; do not update them silently. See docs/SUPABASE_SETUP.md for the distinction between app keys, MCP OAuth and database access. Keep project-specific configuration in ignored local files or environment settings.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
