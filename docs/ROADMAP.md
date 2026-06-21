# i18n_me Roadmap

> **Goal**: [GOAL.md](GOAL.md) | **ADR Board**: [ACTIVE.md](adr/ACTIVE.md)

Decompose work into Flags: discrete end-state declarations, each independently verifiable. Do not use P0/P1/P2 priority labels unless this project adopts an explicit external priority system. Do not use Wave labels for new work.

## Current Focus

The project control plane is initialized. Product roadmap items are unknown until the maintainer states the next desired behavior change.

## Dependency Map

```text
Flag A: Agent routing docs exist and point agents to project facts <- no dependencies
  Flag B: ADR board and automation can lint and regenerate <- depends on Flag A
Flag C: Project purpose and architecture facts are documented from existing evidence <- no dependencies
```

## Flags

| Flag | End-state (WHAT, not HOW) | Depends on | Verification | Status |
|---|---|---|---|---|
| A | Agents can route common work through `AGENTS.md` without reading the whole repository first. | none | `AGENTS.md` exists and names task-specific first-read files and verification gates. | Implemented |
| B | ADR decisions can be indexed and linted from machine-readable frontmatter. | Flag A | `make adr-lint` exits 0 and `make adr-index` regenerates `docs/adr/ACTIVE.md`. | Implemented |
| C | Project goal and architecture facts are documented without invented behavior. | none | `docs/GOAL.md` and `docs/ARCHITECTURE.md` contain only README-confirmed or code-confirmed facts, with unknowns listed plainly. | Implemented |

## Deferred Work

| Item | Trigger | Why deferred |
|---|---|---|
| Product PRD corpus | A business boundary needs living product contracts beyond `GOAL.md`. | The current repository has no scattered product-spec corpus to centralize. |
| Real Telegram acceptance script | A maintainer supplies credentials, session setup, and expected test chats. | The repository cannot safely invent or commit Telegram credentials. |
| Unit or integration test suite | A behavior change needs a durable regression check. | The current repository does not include a test runner or tests. |
| Ax translation optimization | The maintainer has a small translation eval set and wants to compare prompt or demo quality. | Ax should serve offline effect engineering, not Telegram runtime, DB writes, or message editing. |

## Recent Evidence

- 2026-05-22: `project-init` classified the repo as partial-to-empty for governance because README and code exist, but agent docs, project truth docs, and ADR automation were absent.
- 2026-05-22: `make adr-lint` exited 0 with 0 ADRs, and `make adr-index` regenerated `docs/adr/ACTIVE.md`.
