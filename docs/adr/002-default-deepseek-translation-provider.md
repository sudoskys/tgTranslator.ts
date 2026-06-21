---
id: ADR-002
title: Default Translation Provider To DeepSeek
status: Implemented
date: 2026-05-24
author: Codex
supersedes: []
superseded_by: null
prds: []
summary: Default translation calls to DeepSeek while keeping OpenAI-compatible overrides.
---

# ADR-002: Default Translation Provider To DeepSeek

> **Status**: see frontmatter.status. History of status changes lives in `## Implementation Log` and `git log`.

## Context

The translation service uses the `openai` SDK against an OpenAI-compatible chat completion API. Before this ADR, the service defaulted to OpenAI's API URL and `gpt-4o-mini` when the operator did not set `OAI_BASE_URL` or `OAI_MODEL`. The maintainer chose DeepSeek as the default provider, while keeping the existing target-language command flow.

The quality expectation in this ADR is a 期望值估算. The repository does not yet contain translation eval fixtures that prove DeepSeek produces better translations for this project.

## Flags

### Flag 1: DeepSeek Is The Default Translation Provider

**Expectation.**

The operator starts the UserBot with `OAI_API_KEY` but without `OAI_BASE_URL` or `OAI_MODEL`. The translation service calls DeepSeek's OpenAI-compatible API at `https://api.deepseek.com` and uses `deepseek-v4-flash`. An operator who wants another compatible provider can still override both values through environment variables.

This Flag keeps the runtime behavior simple. The product command surface remains `,use <target language>` and `tl <text>`.

**Verification.**

The static contract is checked by TypeScript and build verification. `pnpm exec tsc --noEmit` and `pnpm run build` must compile the service with the new defaults. A real-path verification still requires a DeepSeek-compatible API key and one translation request.

**Reference.**

- [src/services/translation.service.ts](../../src/services/translation.service.ts) — provider default owner
- [README.MD](../../README.MD) — operator environment example
- [DeepSeek API Docs](https://api-docs.deepseek.com/) — OpenAI-compatible API reference

### Flag 2: Ax Stays Out Of Runtime Until Eval Exists

**Expectation.**

The operator sends `tl hello` after setting a target language. The runtime path continues through `TranslationService`, `@instructor-ai/instructor`, and the OpenAI-compatible client. Ax does not own Telegram message handling, database writes, provider fallback, or message editing.

Ax may become useful after the project has a small translation eval set. In that future path, Ax should optimize prompts or examples offline and produce artifacts that a maintainer reviews before promotion.

**Verification.**

The static contract is checked by dependency and source inspection. `package.json` must not depend on `@ax-llm/ax` for this ADR, and source search must find no runtime Ax import. The roadmap records Ax as deferred offline effect engineering.

**Reference.**

- [docs/ROADMAP.md](../ROADMAP.md) — deferred Ax optimization item
- [src/services/translation.service.ts](../../src/services/translation.service.ts) — current runtime translation owner

## Considered Alternatives

| Option | Why rejected |
|---|---|
| Add Ax directly to runtime | The project has no eval fixtures yet. Runtime Ax would add mechanism before there is a promotion gate. |
| Add translation style profiles now | The existing target-language command is useful and low-friction. Profiles would add product surface before the maintainer has asked for that behavior. |
| Rename `OAI_*` environment variables | The current names already mean OpenAI-compatible API configuration. Renaming would create migration cost without changing behavior. |

## Implementation Log

### 2026-05-24 DeepSeek Defaults Implemented

**Executor**: Codex

**Scope**:
- `src/services/translation.service.ts` now defaults `OAI_BASE_URL` to `https://api.deepseek.com`.
- `src/services/translation.service.ts` now defaults `OAI_MODEL` to `deepseek-v4-flash`.
- README, GOAL, ARCHITECTURE, and ROADMAP now describe the DeepSeek default and Ax boundary.

**Evidence**:

```bash
pnpm exec tsc --noEmit
pnpm run build
rg -n "@ax-llm/ax|from ['\"]@ax-llm/ax|deepseek-chat|deepseek-reasoner" src package.json pnpm-lock.yaml
make adr-lint
make adr-index
```

**Unverified Real Path**:

A real translation request through DeepSeek still needs an API key. This repository does not contain one.

## References

- [docs/GOAL.md](../GOAL.md) — product goal and constraints
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md) — current code-confirmed architecture
- [DeepSeek API Docs](https://api-docs.deepseek.com/) — provider API reference
