# i18n_me Architecture

This document records code-confirmed or README-confirmed facts. Mark unknowns honestly; do not guess.

## System Boundary

- In scope: a single Telegram UserBot process that translates the operator's own messages.
- In scope: per-chat settings persisted in the configured SQLite/libSQL database.
- Out of scope: hosted multi-user service behavior, external admin UI, billing, and analytics.

## Modules

| Module | Responsibility | Notes |
|---|---|---|
| `src/index.ts` | Creates the `mtcute` client, registers command handlers, filters non-operator messages, and edits translated messages. | The handler uses `filters.me` after `mtcute` authenticates the operator account. |
| `src/services/translation.service.ts` | Wraps the OpenAI-compatible client and returns output-only translated text. | The service requires `OAI_API_KEY`; `OAI_BASE_URL` defaults to DeepSeek's API URL, and `OAI_MODEL` defaults to `deepseek-v4-flash`. |
| `src/services/chatSettings.service.ts` | Reads and writes per-chat translation settings through Drizzle. | The service runs migrations from `./drizzle` during startup. |
| `src/db/schema.ts` | Defines the `chat_settings` table. | The table stores `chatId`, `enabledTranslate`, and `targetLanguage`. |
| `src/schemas/*.schema.ts` | Defines Zod schemas and TypeScript types for service data. | `targetLanguage` is limited to 1-100 characters. |
| `drizzle/` | Stores generated SQLite migration files and metadata. | The initial migration creates the settings table. |

## Data Flow

```text
Telegram text message from operator
  -> mtcute dispatcher in src/index.ts
  -> ChatSettingsService reads per-chat settings
  -> TranslationService calls the OpenAI-compatible chat completion API
  -> mtcute MessageContext.edit edits the original Telegram message
```

```text
Telegram command from operator
  -> command handler in src/index.ts
  -> ChatSettingsService upserts settings
  -> optional TranslationService confirmation message
  -> mtcute MessageContext.edit edits the original command message
  -> short status commands may delete the edited command message after a short delay
```

## Authority And State

| Public question or durable fact | Source of truth | Readers | Failure behavior |
|---|---|---|---|
| Which Telegram account may control the bot? | `mtcute` authenticated self state through `filters.me` | Message handlers | Non-matching senders return without action. |
| Is translation enabled for a chat? | `chat_settings.enabledTranslate` | Message and command handlers | Missing settings disable translation. |
| What target language should a chat use? | `chat_settings.targetLanguage` | Translation and command handlers | New settings default to `In Fluent English With Internet Style`. |
| What text did the model produce? | OpenAI-compatible API response text | Message edits and command status output | Translation failure logs an error and either leaves the message unchanged or edits command status to an error. |

## External Dependencies

| Dependency | Required? | Purpose | Failure behavior |
|---|---|---|---|
| Telegram MTProto via `mtcute` | yes | Read and edit Telegram messages as a UserBot. | Startup or message operations can fail when credentials, session, or network are unavailable. |
| DeepSeek/OpenAI-compatible API via `openai` | yes for translation | Generate translated text. | Missing `OAI_API_KEY` disables translation behavior. |
| SQLite/libSQL via Drizzle | yes for settings | Persist per-chat settings. | Startup migration or settings reads/writes can fail. |
| `dotenv` | yes | Load local environment variables. | Missing variables fall back only where code defines defaults. |

## Interfaces

| Interface | Owner | Contract |
|---|---|---|
| Telegram commands | `src/index.ts` | `ping`, `on`, `off`, `use <lang>`, `show`. Each accepts the prefixes `/`, `,`, and full-width `，`. `on`/`off` are idempotent translation switches; `use` sets the target language and enables translation. Command status edits the original command message; short status commands (`ping`, `on`, `off`) delete the edited message after a short delay. |
| Telegram text prefix | `src/index.ts` | Messages beginning with `tl` are candidates for translation when chat translation is enabled. |
| Environment variables | Runtime process | `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION_FILE`, `OAI_BASE_URL`, `OAI_API_KEY`, `OAI_MODEL`, `DB_FILE_NAME`, and `LOG_LEVEL`. |
| Database table | `src/db/schema.ts` | `chat_settings(id, chatId, enabledTranslate, targetLanguage)`. |
| Translation result | `src/services/translation.service.ts` | The translation service returns a translated string. |

## Verification

```bash
pnpm run check-type
make adr-lint
make adr-index
```

Real-path verification for behavior changes needs Telegram credentials, a session file, a configured OpenAI-compatible API key, and a local database file.

## Known Unknowns

- The repository does not document a unit test command.
- The repository does not document a reproducible local Telegram test fixture.
- The repository defaults to DeepSeek, but it does not document provider-specific guarantees for other custom `OAI_BASE_URL` values.
