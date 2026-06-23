---
target: interaction-model
date: 2026-06-22
author: "研究员"
status: active
supersedes: []
supplements: []
benchmarks:
  - mtcute
  - kastaid-ds
  - getter
  - translation-agent
summary: "Ideal command→edit interaction logic for the i18n_me UserBot: one routing primitive (command), one effect (in-place edit), tl as a first-class reply-aware command."
---

# Greenfield: i18n_me Interaction Model — "命令 → 编辑"

## §0 Document positioning

This is **not a migration plan.** It defines the technical ideal end-state of the
operator-facing interaction logic, assuming the bot is rebuilt from scratch today.
It carries no F-flags, no dual-listener, no rollback or cutover steps. A separate
migration document — if the maintainer decides to converge the current `src/index.ts`
toward this state — would reference this file as its target.

Downstream decision this informs (per skill input): **重构优化当前应用为更理想的状态** —
whether and how to collapse the current two-mode routing into a single, simpler model.

One sentence: *If i18n_me's interaction logic were built from zero today, every operator
action is a **command**, and a translation command's only effect is to **edit the message
in place** — there is no second, implicit routing mechanism.*

---

## §1 Per-layer selection table

The system needs exactly six layers. It has no auth-beyond-self, billing, observability,
or multi-tenant layer — those are out of scope per `docs/GOAL.md`.

| Layer | Selection | Rejected alternatives | Rejection reason | Benchmark evidence |
|-------|-----------|----------------------|------------------|--------------------|
| Telegram runtime | Single MTProto **UserBot** via `mtcute` `TelegramClient` | Bot-API client (grammY/telegraf); Python tdlib/Telethon/Pyrogram | Bot-API accounts cannot edit the operator's *own* messages or act as self; the entire product is "edit my own message", so MTProto userbot is mandatory. mtcute is the only TS-native MTProto option. | `mtcute` docs/guide/intro/*; `docs/GOAL.md` success criteria `evidence-backed` |
| Command routing | One **declarative command table** → `filters.command` + `filters.regex`; **every** trigger (including `tl`) is a command | Catch-all `onNewMessage` handler that runs on every own message and does `text.startsWith("tl")` (current `src/index.ts:159-168`) | A catch-all that string-matches inside its body is non-declarative: it fires on every keystroke-sent message, scatters routing into handler logic, and cannot compose with other filters. A command filter only invokes the handler when the trigger matches. | `kastaid-ds` `ds/kasta.py` `@KastaClient.on_message(filters.command(...) & filters.me)`; `getter` `kasta_cmd(pattern=...)` (design-only); `mtcute` docs/guide/dispatcher/filters.md:70-75 `evidence-backed` |
| `tl` trigger | Regex command `^tl(\s|$)`, fires on edited messages too, **reply-aware** | Keep `tl` as an implicit prefix checked inside the catch-all; OR demote `tl` to a slash command `/tl` | A regex command keeps the low-friction bare-`tl` prefix the maintainer prefers ("tl 比较好") while making it a first-class, declarative route. Reply-awareness lets the operator translate a quoted message, which a prefix-only path cannot. | `getter` `getter/plugins/translate.py:71` `kasta_cmd(pattern=r"tl(?: \|$)([\s\S]*)", edited=True)` + `is_reply` branch (design-only); `mtcute` filters.md:70 `filters.regex` `evidence-backed` |
| Edit effect | Translate verb **replaces** the source message via `msg.edit({ text })` | Reply with a new annotated message (the `tr` style — "Detected/Translated" block) | The operator wants their own outgoing message to *become* the translation for cross-language chat; a reply pollutes the conversation with bot artifacts and breaks the illusion of native speech. | `getter` `translate.py` `tl` (edit/replace) vs `tr` (annotated reply) split (design-only); `docs/GOAL.md` "have `tl` messages edited into translated text" `evidence-backed` |
| Translation | **Single-chunk** LLM call, output-only plain-text system prompt | `@instructor-ai/instructor` JSON/Zod structured output (current `translation.service.ts` history); multi-step reflect→improve | Chat messages are short single utterances; structured JSON imposes a "format tax" that degrades reasoning (arxiv 2408.02442, already cited at `translation.service.ts:55`), and reflection latency is unjustified for one-liners. | `andrewyng/translation-agent` `src/translation_agent/utils.py:231` `one_chunk_translate_text`, `:87` output-only system message; `translation.service.ts:57` `evidence-backed` |
| Settings persistence | Per-chat row in SQLite/libSQL via Drizzle (`chatId`, `enabledTranslate`, `targetLanguage`) | Global in-memory config only; fully stateless per-message | Settings must survive process restart (`GOAL.md` success criteria) and must be per-chat (different chats target different languages). A global config cannot express per-chat targets. | in-repo `src/services/chatSettings.service.ts`; `kastaid-ds` `ds/config.py:28` `Var` (global-only — rejected for per-chat) `evidence-backed` |
| Config / secrets | env-driven **typed config object**, secrets never committed | Hardcoded constants; committed `.env`/session | Secrets (`TELEGRAM_API_HASH`, session, `OAI_API_KEY`) must stay out of git (`AGENTS.md` hard rule); a typed object centralizes env reads and fails fast on missing required vars. | `kastaid-ds` `ds/config.py:15` `env()` + `:28` `class Var`; in-repo `readRequiredEnv` `src/index.ts:12` `evidence-backed` |

Every selection above is `evidence-backed`. No `期望值估算` rows.

### §1a Conversation context (refinement, 2026-06-23)

The translate verb now sends **recent conversation context** as a disambiguation
input: the most recent ~7 messages plus the reply-to message (highlighted). **One
unified mental model** — reply-to is just the highlighted member of the recent
window, not a separate path. Context resolves pronouns, register, and ambiguity in
short utterances. Still single-chunk, output-only, no reflection.

This extends the original `tl` trigger row, which scoped context to reply-to only.
The translation system prompt also shifts from "professional translator" to a
**transcreation** persona (be the speaker, not a word-for-word translator), bounded
by a "do not add/drop meaning" rule, and temperature drops 1.0 → 0.3.

Evidence: TowerChat WMT24 (context +4 CHRF), Sung et al. WMT24 (recent turns +
summary), *Lost in Literalism* ACL 2025 (translationese), Unbabel transcreation
EAMT 2024 (ZH/JA/KO), Peng et al. (low temp for Chinese MT). Same-class production
userbot `aimoda/telegram-auto-translate` uses a 10-msg window. Caveat preserved: a
non-chat-finetuned model can use context poorly (TowerChat), so the window is kept
small (7) and the context is clearly fenced as "do not translate this".
@see docs/research/2026-06-23-translation-quality-evidence.md

---

## §2 Directory structure

Top-level under `src/`: **4** entries (`bot/`, `translate/`, `settings/`, `config.ts`) — within the ≤7 budget. One concern per directory; routing and Telegram I/O do not scatter.

```text
src/
├── bot/                      # Telegram runtime + declarative routing — benchmark: mtcute docs/guide/dispatcher
│   ├── client.ts             # build TelegramClient, start()/auth — benchmark: mtcute docs/guide/intro
│   ├── router.ts             # one command table → dispatcher registration — benchmark: kastaid-ds ds/kasta.py
│   └── commands/             # one file per command: spec + handler co-located — benchmark: getter/plugins (design-only)
│       ├── translate.ts      # `tl`: inline-or-reply text → translate → msg.edit — benchmark: getter/plugins/translate.py (design)
│       ├── settings.ts       # `use` / `toggle` / `show` — benchmark: kastaid-ds ds/plugins/*.py
│       └── ping.ts           # `ping`: liveness + chat id — benchmark: kastaid-ds ds/plugins/misc.py
├── translate/                # LLM translation; prompt owns output-only contract — benchmark: andrewyng/translation-agent
│   └── service.ts            # single-chunk translate(text, target) — benchmark: translation-agent src/translation_agent/utils.py:231
├── settings/                 # per-chat settings store — benchmark: in-repo chatSettings.service.ts
│   ├── store.ts              # get / upsert per-chat row (Drizzle) — benchmark: in-repo chatSettings.service.ts
│   └── schema.ts             # chat_settings table + zod — benchmark: in-repo src/db/schema.ts
└── config.ts                 # env-driven typed config, fail-fast on required — benchmark: kastaid-ds ds/config.py:28
```

What changed from today's tree, and why it is ideal (not migration steps — just the contrast):
- The catch-all translate handler disappears. `tl` lives in `bot/commands/translate.ts` as a regex command.
- The 7 hand-written `dp.onNewMessage(...)` lines (`src/index.ts:222-229`) collapse into one `router.ts` table iterated once. Comma-prefix variants become a `prefixes` option on the table row, mirroring `ds` `filters.command([...], prefixes=Var.HANDLER)`.

---

## §3 Correspondence table

For each greenfield package, the readable benchmark file that shows what it should look like.

| Greenfield package | Benchmark source | Benchmark path | Correspondence |
|--------------------|------------------|----------------|----------------|
| `bot/client.ts` | mtcute (local) | `docs/reference/mtcute/docs/guide/intro/*` | TelegramClient construction + `start()` auth flow; current `index.ts:204-235` already matches |
| `bot/router.ts` | kastaid-ds (MIT) | `~/.agents/refs/kastaid-ds/ds/kasta.py` + `ds/plugins/delayspam.py:23` | `@on_message(filters.command([...], prefixes=...) & filters.me & ~filters.forwarded)` — declarative command + self-filter; map to mtcute `filters.and(filters.me, filters.command(...))` |
| `bot/commands/translate.ts` | getter (AGPL, /tmp, **design-only**) | `/tmp/gf-refs/getter/getter/plugins/translate.py:71` | `tl` as `kasta_cmd(pattern=..., edited=True)`, reply-aware text source, progress `eor("...")` → final edit. Observe design; do not copy AGPL code. |
| `bot/commands/settings.ts` | kastaid-ds (MIT) | `~/.agents/refs/kastaid-ds/ds/plugins/misc.py`, `delayspam.py` | per-command handler with docstring-as-help; current command status uses in-place edit instead of reply/delete cleanup |
| `translate/service.ts` | translation-agent (MIT) | `~/.agents/refs/translation-agent/src/translation_agent/utils.py:231,87` | `one_chunk_translate_text`; expert-linguist output-only system message; matches current `translation.service.ts:38-67` |
| `settings/store.ts` + `schema.ts` | in-repo | `src/services/chatSettings.service.ts`, `src/db/schema.ts` | get/upsert per-chat row; already the source of truth, retained as-is |
| `config.ts` | kastaid-ds (MIT) | `~/.agents/refs/kastaid-ds/ds/config.py:15,28` | `env(key, default)` helper + typed `Var` class; fail-fast mirrors current `readRequiredEnv` `index.ts:12` |

Benchmark availability table:

| Project | License | Layer coverage | Local path | Why selected |
|---------|---------|----------------|------------|--------------|
| mtcute | MIT | Telegram runtime, routing, filters, edit | `docs/reference/mtcute/` | The framework this bot runs on; canonical for dispatcher/filters/edit |
| kastaid-ds | MIT | command routing, self-filter, config, command cleanup | `~/.agents/refs/kastaid-ds/` | Maintained userbot; MIT → code-referenceable routing+config patterns |
| getter | AGPL-3.0 | `tl`/`tr` translate command, reply-aware, in-place edit | `/tmp/gf-refs/getter/` | Real userbot with the exact `tl` translate-and-edit pattern; **design observation only** |
| translation-agent | MIT | LLM translation prompt, single-chunk vs multi-chunk | `~/.agents/refs/translation-agent/` | Andrew Ng's reference for translation prompting; already cited in source |

4 independent projects, all locally readable. ≥3 satisfied.

---

## §4 What this document is NOT

- **Not a migration plan.** No F-flags, no dual-listener, no kill criteria, no rollback, no scheduling, no budget.
- **Not an ADR.** No status lifecycle beyond `active`/`superseded`.
- Contains **no** migration-specific packages — no adapters, no compatibility shims, no `_deprecated` paths, no dual routing stacks. The current catch-all handler is described only as the rejected alternative in §1, never as a transitional component.

---

## §5 Adversarial review (red/blue, redesign-of-existing vectors)

Attacked the design from the "redesign of an existing system" vectors.

- **"Is the routing-collapse supported by a benchmark, or extrapolated?"** Supported. `kastaid-ds` registers every trigger via `filters.command(...) & filters.me`; `getter` registers `tl` via `kasta_cmd(pattern=...)`. Neither uses a catch-all string-match. The current bot is the outlier. `evidence-backed`.
- **"Does the benchmark operate at our complexity?"** getter/ds are larger (30+ plugins) but the *routing primitive* is identical at any scale; we adopt only the primitive, not the plugin sprawl (guards against second-system effect).
- **"Is a rejected alternative actually better for us?"** The catch-all is only 'better' if we needed to inspect every message — we do not; `tl` is an explicit opt-in. The instructor/JSON path is only better if output needed structure — it does not; output is one plain string. Both rejections hold.
- **"Hedge words hiding undecided choices?"** Selection table grepped for 如果/可能/兼容/部分/INCONCLUSIVE — none present in §1 selections.
- **"Reply-aware tl — real need or feature creep?"** Bounded: it is the same handler reading `msg.getReplyTo()` (current code already calls this at `index.ts:51` for `/use`), not a new subsystem. Net code shrinks. Accepted.

**Verdict: PASS.** No BLOCK or ASK items. The design reduces routing surface (7 registrations → 1 table; 2 mechanisms → 1) while preserving the maintainer's preferred bare-`tl` ergonomics.

---

## §6 Labels

- **Migration honesty:** *path exists.* The current code can converge to this state incrementally (replace catch-all with a `tl` regex command first, then table-ize registrations) — but that path lives in a separate migration doc, not here.
- **Disposable label:** This document defines the **target**. Implementation is a separate effort; this file is living truth, not a one-off spike.
- **Evidence quality:** 0% `期望值估算` in §1; all six layers cite a readable benchmark or in-repo source.
- **Next move:** `write migration plan` — a short flag set to (1) make `tl` a `filters.regex` command, (2) collapse the registration block into a table, (3) add reply-aware source selection. Each is independently verifiable against a real Telegram session.
