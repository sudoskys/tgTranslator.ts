# i18n_me Agent Guide

This file routes agent work. It is not a README, tutorial, or changelog.

## Task Routing

| Task type | First read | Workflow / skill | Verification gate |
|---|---|---|---|
| Understand purpose | `docs/GOAL.md` and `README.MD` | Extract the user, goal, non-goals, and unknowns | Restate goal, users, non-goals, and unknowns |
| Plan roadmap work | `docs/ROADMAP.md` | Flag-based decomposition with independently verifiable end states | Updated Flag set or explicit no-change reason |
| Architecture decision | `docs/adr/ACTIVE.md` | ADR decision workflow | ADR has classification, invariant, alternatives, verification, and implementation log |
| Adding enforcement, boundary check, cap, quota, silent skip, fallback, retry, or early return | Relevant source owner in `src/` | `preflight` skill | Filled 6-field artifact before the first edit |
| Telegram command or message-flow change | `src/index.ts` and `docs/ARCHITECTURE.md` | TypeScript change with real-path awareness | Focused check plus manual or real Telegram verification when credentials are available |
| Translation behavior change | `src/services/translation.service.ts` and `src/schemas/translation.schema.ts` | Data/API behavior review | Build check plus real OpenAI-compatible request when credentials are available |
| Chat settings or database change | `src/services/chatSettings.service.ts`, `src/db/schema.ts`, and `drizzle/` | Data design and migration review | Drizzle migration check against a real local SQLite/libSQL database |
| Test strategy | Existing code paths and failure evidence | Testing methodology | Reproduction or fidelity-appropriate test |
| Security or secrets | `README.MD`, `.gitignore`, and affected code | Security review | Confirm `.env`, Telegram session, and generated secrets stay out of git |

## Quick Commands

```bash
pnpm install
pnpm run start
pnpm run build
pnpm run build:prod
make adr-lint
make adr-index
```

## Hard Rules

always:
- Route the task before editing.
- State the verification path before implementation.
- Prefer real-path verification when correctness depends on Telegram, OpenAI-compatible APIs, or SQLite/libSQL.
- Keep `.env`, local Telegram config, `*.session`, and local database files out of git.
- Before adding a new gate, cap, quota, silent skip, fallback, retry, or early return that enforces a named concept in the existing system, run the `preflight` skill and fill its 6-field artifact in the PR, commit message, or ADR.

ask first:
- Delete files or discard uncommitted changes.
- Add new infrastructure, paid services, or broad compatibility layers.
- Assume backward compatibility is required when consumers are unknown.

never:
- Commit secrets or Telegram session material.
- Invent project commands, goals, architecture, or tests.
- Treat mocks, generated files, caches, or local database snapshots as source of truth.
