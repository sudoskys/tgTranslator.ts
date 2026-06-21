---
id: ADR-001
title: Migrate Telegram Client To mtcute
status: In Progress
date: 2026-05-22
author: Codex
supersedes: []
superseded_by: null
prds: []
summary: Replace tgsnake with mtcute while preserving the UserBot translation contract.
---

# ADR-001: Migrate Telegram Client To mtcute

> **Status**: see frontmatter.status. History of status changes lives in `## Implementation Log` and `git log`.

## Context

The current UserBot receives Telegram updates through `tgsnake` in `src/index.ts`. That file owns the Telegram client, operator filtering, command routing, command deletion, replies, and edits to translated messages. The translation service and chat settings database do not depend on `tgsnake`.

The project now carries `mtcute` as a reference submodule under `docs/reference/mtcute`. `mtcute` provides a Node.js Telegram client, persistent SQLite session storage, a dispatcher, command filters, message replies, message deletion, and message editing. This ADR records the migration decision before code changes so future maintainers can see what must stay true during the replacement.

The effort and risk judgments in this ADR are 期望值估算, not incident-proven conclusions. The code facts come from the current repository and the `mtcute` reference submodule.

This decision is a migration decision. It changes the Telegram MTProto client boundary, not the product goal.

## Flags

### Flag 1: The Telegram Boundary Uses mtcute

**Expectation.**

The operator starts the process with Telegram API credentials and a persisted session. The process constructs an `mtcute` `TelegramClient` and registers update handlers through `@mtcute/dispatcher`. No runtime Telegram behavior imports `tgsnake`, `@tgsnake/core`, or `tgsnake` internal types after this Flag is implemented.

This Flag keeps the client boundary single-owned. A future reader should not have to reason about two Telegram frameworks in the same message path.

**Verification.**

The static contract is checked by build and grep-level inspection. `pnpm run build` must compile the TypeScript entrypoint, and a repository search for `tgsnake` must find only historical documentation or migration notes until those notes are deliberately removed. The stronger runtime contract is a real Telegram startup using the migrated client and persisted `mtcute` session.

**Reference.**

- [src/index.ts](../../src/index.ts) — current Telegram boundary
- [docs/reference/mtcute/docs/guide/intro/sign-in.md](../reference/mtcute/docs/guide/intro/sign-in.md) — mtcute sign-in contract
- [docs/reference/mtcute/docs/guide/topics/storage.md](../reference/mtcute/docs/guide/topics/storage.md) — mtcute session storage

### Flag 2: Operator-Only Behavior Is Preserved

**Expectation.**

The operator sends `/show`, `,show`, or a `tl` message from the authenticated account. The migrated handler processes the message. Another Telegram account sends the same text in the same chat, and the migrated handler does nothing.

This is the central safety property of the project. The bot translates the operator's own messages only.

**Verification.**

The real-path check must use at least two Telegram accounts in a chat where the UserBot account can observe messages. The operator account must receive command behavior and message edits, while the other account must not trigger settings writes, replies, deletions, or edits. A static review must also confirm that the migrated handler derives identity from `mtcute` self state or `filters.me`, not from user-supplied message text.

**Reference.**

- [docs/GOAL.md](../GOAL.md) — operator-only product goal
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md) — current authority table
- [docs/reference/mtcute/packages/dispatcher/src/filters/user.ts](../reference/mtcute/packages/dispatcher/src/filters/user.ts) — `filters.me` behavior

### Flag 3: Existing Command Semantics Stay Stable

**Expectation.**

The operator can call `/ping`, `/local`, `/use`, `/show`, `,local`, `,use`, and `,show` after the migration. The commands keep their current observable behavior: ping replies with the chat ID, local toggles translation, use stores the target language, and show reports the stored settings. Command messages that are currently deleted after a delay remain deleted after a delay unless Telegram rejects deletion.

This Flag makes the migration reversible and reviewable. It keeps command behavior out of the client-library decision.

**Verification.**

The real-path check must exercise every command form in one private chat or group chat and inspect the visible Telegram result. The database check must confirm that `chat_settings.chatId`, `enabledTranslate`, and `targetLanguage` changed only as the command semantics require. `pnpm run build` guards the TypeScript surface, but it does not prove command behavior by itself.

**Reference.**

- [src/index.ts](../../src/index.ts) — current command semantics
- [src/services/chatSettings.service.ts](../../src/services/chatSettings.service.ts) — settings write path
- [docs/reference/mtcute/docs/guide/dispatcher/filters.md](../reference/mtcute/docs/guide/dispatcher/filters.md) — command filter contract
- [docs/reference/mtcute/packages/dispatcher/src/context/message.ts](../reference/mtcute/packages/dispatcher/src/context/message.ts) — reply and delete helpers

### Flag 4: `tl` Messages Still Edit The Original Message

**Expectation.**

The operator enables translation in a chat and sends `tl hello`. The migrated path calls the translation service and edits that same Telegram message to the translated text. It does not send a replacement message unless Telegram editing fails and a future ADR explicitly changes the behavior.

This Flag preserves the product feel. The UserBot should continue to turn the operator's own draft-like message into translated text in place.

**Verification.**

The real-path check must send a `tl` message with translation enabled and inspect that the original message ID now contains the translated text. A failure-path check must also send a `tl` message when translation is disabled and confirm the message remains unchanged. Build checks and mock-only tests are insufficient for this Flag because Telegram edit permissions, message IDs, and MTProto update shape matter.

**Reference.**

- [src/index.ts](../../src/index.ts) — current `tl` edit path
- [src/services/translation.service.ts](../../src/services/translation.service.ts) — translation API path
- [docs/reference/mtcute/packages/dispatcher/src/context/message.ts](../reference/mtcute/packages/dispatcher/src/context/message.ts) — message edit helper
- [docs/reference/mtcute/packages/core/src/highlevel/methods/messages/edit-message.ts](../reference/mtcute/packages/core/src/highlevel/methods/messages/edit-message.ts) — low-level edit implementation

### Flag 5: Chat Settings Keep The Same Chat Identity

**Expectation.**

A chat that already has settings before the migration sends `,show` after the migration. The migrated handler reads the same `chat_settings` row and reports the same translation state. It must not silently create a second row because the new client exposes a different chat ID shape.

This Flag protects the only durable user data owned by the project. A client-library replacement must not look like a settings reset.

**Verification.**

The real-path check must record one pre-migration chat ID, run the migrated handler in that same chat, and confirm that `mtcute` resolves the same marked chat ID. The database check must query the configured SQLite/libSQL database and confirm that commands reuse the existing `chat_settings.chatId` row. If the IDs differ, the implementation must stop and propose a separate data migration instead of hiding the mismatch behind compatibility code.

**Reference.**

- [src/db/schema.ts](../../src/db/schema.ts) — settings table shape
- [src/services/chatSettings.service.ts](../../src/services/chatSettings.service.ts) — settings lookup key
- [docs/reference/mtcute/packages/core/src/utils/peer-utils.ts](../reference/mtcute/packages/core/src/utils/peer-utils.ts) — marked peer ID rules

## Problem Classification

| Question | Answer |
|---|---|
| What is the output? | A Telegram UserBot message flow that behaves the same while using a different MTProto client. |
| What is stored? | Telegram session state in the client library and per-chat settings in the project database. |
| Consistency requirement? | Single-process local consistency. The process must use one authenticated operator identity and one chat ID shape. |
| Time semantics? | Immediate message handling. Missed updates may be caught up only if the migrated client is configured that way. |
| Failure behavior? | Startup must fail loudly when Telegram credentials or session setup are invalid. Message operations may log Telegram failures and leave messages unchanged. |
| Who answers externally? | The local UserBot process answers through Telegram replies, deletions, and message edits. |
| Operating envelope? | One operator account, one process, local database, and normal chat-scale traffic. No hosted multi-tenant envelope is in scope. |

## Considered Alternatives

| Option | Why rejected |
|---|---|
| Keep `tgsnake` | It avoids migration cost, but it leaves the Telegram boundary tied to a framework the project is now explicitly evaluating for replacement. |
| Wrap both clients behind an adapter | The project has one Telegram implementation. A dual-client adapter would add abstraction before there are two live implementations. |
| Convert the existing session before first run | `mtcute` documents conversion for several libraries, but not for `tgsnake`. Fresh `mtcute` login being lower-risk is a 期望值估算. |

## Preflight

### 1. Triggering symptom

The user asked to execute ADR-001, which replaces the Telegram client boundary and must preserve operator-only handling.

### 2. Core concept being enforced

The enforced concepts are `operator identity`, `Telegram credentials`, and `chat settings identity`.

### 3. Authority points — current owners

- `operator identity`: `docs/GOAL.md:7` — the primary user is the Telegram account operator.
- `operator-only behavior`: `docs/GOAL.md:26` — the bot refuses messages outside the authenticated operator.
- `runtime operator source`: `docs/ARCHITECTURE.md:44` — `client._me.id` is the current authority for the controlling account.
- `settings identity`: `docs/ARCHITECTURE.md:45` and `docs/ARCHITECTURE.md:46` — `chat_settings` stores enablement and target language by chat.
- `Telegram credentials`: `README.MD:42` and `README.MD:47` — the current setup requires Telegram `apiHash` and `apiId`.

### 4. Call chain to the proposed change locus

`pnpm run start` in `package.json:5` -> `src/index.ts:371` starts the Telegram client -> `src/index.ts:373` stores the authenticated account ID -> `src/index.ts:20` and message handlers enforce operator-only behavior.

### 5. Proposed change locus and relation to authority

- Planned edit: `src/index.ts:1`.
- Relation to authority point in section 3: same layer.

The change keeps the same boundary owner. It replaces the client object and dispatcher API inside `src/index.ts` instead of adding a second downstream permission layer.

### 6. Root-cause hypothesis with falsification attempt

- Hypothesis: `src/index.ts` is the only runtime owner of Telegram identity, command routing, deletion, replies, and message editing.
- I tried to falsify it by running `rg -n "myId|notMe|client\\.use|client\\.run|_me|tgsnake\\.config|apiHash|apiId|TELEGRAM|TG_" src/index.ts README.MD docs/GOAL.md docs/ARCHITECTURE.md package.json`.
- If the hypothesis were wrong, I would observe another runtime file owning Telegram identity or message dispatch.
- I did not observe that.

## Implementation Log

### 2026-05-22 Static Migration Implemented; Real Telegram Verification Pending

**Executor**: Codex

**Scope**:
- `src/index.ts` now creates an `mtcute` `TelegramClient` and `@mtcute/dispatcher` handlers.
- `package.json` now depends on `@mtcute/node` and `@mtcute/dispatcher`.
- `tgsnake` and the `@tgsnake/core` override were removed from runtime dependencies.
- The dependency change was scoped to the Telegram boundary. Existing OpenAI, Drizzle, libSQL, Zod, dotenv, `drizzle-kit`, and `tsx` versions remain on their prior lockfile resolutions.
- `package.json` now permits the `better-sqlite3` install script through `pnpm.onlyBuiltDependencies` because `@mtcute/node` uses it for SQLite session storage.
- README and architecture documents now describe `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_SESSION_FILE`.
- Status remains `In Progress` because Flag 2 through Flag 5 require a live Telegram account, a second account, and a real chat.

**Evidence**:

```bash
pnpm exec tsc --noEmit
pnpm run build
rg -n "from \"tgsnake|from 'tgsnake|@tgsnake|\"tgsnake\"|tgsnake:" src package.json pnpm-lock.yaml
node -e "import('@mtcute/node').then(({ TelegramClient, SqliteStorage }) => { new TelegramClient({ apiId: 1, apiHash: 'x', storage: ':memory:' }); new SqliteStorage(':memory:'); console.log('mtcute runtime load ok') })"
node - <<'NODE'
import { NodePlatform, SqliteStorage } from '@mtcute/node'
import { LogManager } from '@mtcute/node/utils.js'

const storage = new SqliteStorage(':memory:', { disableWal: true })
const platform = new NodePlatform()
storage.driver.setup(new LogManager(undefined, platform), platform)
await storage.driver.load()
await storage.driver.save()
await storage.driver.destroy()
console.log('mtcute sqlite storage load ok')
NODE
git diff --check
make adr-lint
make adr-index
```

`pnpm exec tsc --noEmit`, `pnpm run build`, `git diff --check`, and `make adr-lint` passed. The `rg` command returned no runtime `tgsnake` dependency matches. The runtime load check constructed the `mtcute` client and SQLite storage through public package exports. The SQLite storage check opened an in-memory `better-sqlite3` database through mtcute after the allowed build script produced the native binding.

**Unverified Real Path**:

Telegram startup, operator-only filtering, command replies, command deletion, original-message edits, and chat ID continuity still need a real Telegram account, a second test account, Telegram API credentials, and a configured local database. This repository does not contain those credentials or a reproducible Telegram fixture.

### 2026-05-22 Execution Started

**Executor**: Codex

**Scope**:
- Status moved from `Proposed` to `In Progress`.
- Preflight recorded before editing `src/index.ts`.

**Evidence**:

```bash
rg -n "myId|notMe|client\\.use|client\\.run|_me|tgsnake\\.config|apiHash|apiId|TELEGRAM|TG_" src/index.ts README.MD docs/GOAL.md docs/ARCHITECTURE.md package.json
```

### 2026-05-22 Initial Proposal

**Executor**: Codex

**Scope**:
- Flags declared: 1 through 5.
- Flags deferred: code migration and real Telegram verification.

**Evidence**:

```bash
git submodule status
```

The reference submodule is present at `docs/reference/mtcute` and points to `439e3d2e4d860818a6bc36aced35a4fdb5d3db06`.

## References

- [docs/GOAL.md](../GOAL.md) — product goal and constraints
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md) — current code-confirmed architecture
- [docs/reference/mtcute](../reference/mtcute) — mtcute reference submodule
- [mtcute sign-in guide](../reference/mtcute/docs/guide/intro/sign-in.md) — authentication and API keys
- [mtcute updates guide](../reference/mtcute/docs/guide/intro/updates.md) — update handling and dispatcher
- [mtcute storage guide](../reference/mtcute/docs/guide/topics/storage.md) — persisted session storage
