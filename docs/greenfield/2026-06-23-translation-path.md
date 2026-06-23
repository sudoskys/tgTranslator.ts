---
target: translation-path
date: 2026-06-23
author: "研究员"
status: active
supersedes: []
supplements:
  - docs/greenfield/2026-06-22-interaction-model.md
benchmarks:
  - translation-agent
  - mtcute
  - getter
  - kastaid-ds
summary: "Ideal translation path for i18n_me: inline source text, no Telegram context assembly, one LLM call, one in-place edit."
---

# Greenfield: Translation Path

## §0 Document positioning

This is **not a migration plan.** It defines the ideal target for the only
translation path in the product: `tl <text>`.

Downstream decision this informs: **remove context assembly while preserving
translation quality through source selection, prompt shape, and model
configuration.**

One sentence: *If the translation path were built from zero today, `tl <text>`
would read only the inline source text, call the configured model once with an
output-only prompt, and edit the same Telegram message in place.*

This supplement replaces `docs/greenfield/2026-06-22-interaction-model.md` §1a
for the `translation-path` sub-scope. The parent interaction model remains
active for routing and edit-in-place interaction.

---

## §1 Benchmark availability

| Project | License | Layer coverage | Local path | Why selected |
|---------|---------|----------------|------------|--------------|
| translation-agent | MIT | LLM translation prompt, single-chunk vs reflect/refine vs multi-chunk context | `~/.agents/refs/translation-agent/` | Reference translation agent that separates one-shot translation from slower improvement and document-context flows. |
| mtcute | MIT | Telegram message context object, reply RPC, edit effect | `docs/reference/mtcute/` | Current runtime framework; source shows which convenience methods incur extra Telegram calls. |
| getter | AGPL-3.0 | Same-class Telegram userbot `tl` command and edit/send behavior | `/tmp/gf-refs/getter/` | Exact userbot interaction pattern; design observation only, no code adoption. |
| kastaid-ds | MIT | Userbot command filters, self-filtering, env config | `~/.agents/refs/kastaid-ds/` | Maintained userbot with explicit command routing and typed config conventions. |

4 independent projects, all locally readable. Activity snapshot: mtcute
`439e3d2e` on 2026-05-17, getter `9ed7441` on 2026-03-15, kastaid-ds
`c956be1` on 2026-03-20, translation-agent `e0fc605` on 2024-07-08.

---

## §2 Per-layer selection table

| Layer | Selection | Rejected alternatives | Rejection reason | Benchmark evidence |
|-------|-----------|----------------------|------------------|--------------------|
| Trigger and source selection | `tl <text>` translates the inline text captured by the command. Empty inline text is a no-op/error surface, not an implicit context lookup. `evidence-backed` | Reply text as default source; recent chat history as source; mixed inline-or-reply source selection | The product action is "edit this message into its translation." Reading a reply or history changes the translation subject and adds Telegram RPCs. getter proves reply-aware `tl` exists as a userbot design, but this product path deliberately selects inline-only after production testing showed context misleads the model. | getter `getter/plugins/translate.py:66-103`; current path `src/index.ts` |
| Context policy | The translation path sends no Telegram conversation context to the model. `evidence-backed` | Recent N-message window via `getHistory`; out-of-window reply fetch via `getReplyTo`; prompt-injected "conversation so far" | mtcute exposes reply lookup as an explicit client call, and the removed feature added `getHistory` before every translation. The user's real deployment test on Gemini 2.5 Flash found this context both slow and misleading. Translation-agent uses context only for document chunks, fenced by `<TRANSLATE_THIS>`, not for a short one-shot utterance. | mtcute `packages/dispatcher/src/context/message.ts:92-95`; removed context feature in `src/index.ts`; translation-agent `src/translation_agent/utils.py:303-344` |
| Translation call shape | One OpenAI-compatible chat completion, plain text output, low temperature, configured model. `evidence-backed` | JSON/Zod structured output; multi-call reflect and improve; reasoning models for ordinary chat turns | The result is one string, so structured output is format overhead. Reflect/improve is valuable for deliberate text but triples request count in translation-agent. The user noted local eval time is irrelevant because request count is the real cost; one call is the hard boundary. | translation-agent one-shot `utils.py:72-97`; reflect/improve orchestration `utils.py:231-260`; current service `src/services/translation.service.ts:38-52` |
| Prompt contract | Output-only transcreation prompt that preserves meaning, leaves URLs/code/mentions intact, and receives only the source text as user content. `evidence-backed` | Prompt that includes "Conversation so far"; prompt that asks for explanations; prompt that answers the content | translation-agent's one-shot prompt explicitly says to provide the translation and nothing else. The current service already has the output-only and "do not answer" rules; the greenfield target removes the context branch from that prompt. | translation-agent `utils.py:87-95`; current `src/services/translation.service.ts:70-95` |
| Model configuration | Keep model choice in env (`OAI_MODEL`) and run the translation path against the deploy-selected fast model, currently Gemini 2.5 Flash. `evidence-backed` | Hardcoding a model in source; choosing reasoning models as the default translation model | Model swaps are operational tuning, not routing logic. The source already reads `OAI_MODEL`; user measurement moved deployment to Gemini 2.5 Flash. Reasoning models spend extra tokens/request behavior on a task that needs one terse string. | current `src/services/translation.service.ts:38-42`; kastaid-ds `ds/config.py:15-34` |
| Edit effect | Successful translation edits the same Telegram message in place. `evidence-backed` | Replying with a new annotated translation; sending a second message; deleting and re-sending | i18n_me exists to turn the operator's outgoing text into the target language. mtcute exposes message edit as the direct primitive; getter distinguishes annotated `tr` from send/edit-like `tl`. | mtcute `packages/dispatcher/src/context/message.ts:193-200`; getter `getter/plugins/translate.py:21-63,66-103`; current `src/index.ts:198-200` |
| Settings and gating | A single settings read gates the translation path: service configured, per-chat enabled, target language present. `evidence-backed` | Global-only language setting; per-request context-derived language; extra LLM call to infer settings | Settings are product state, not translation content. The existing per-chat store is already the source of truth, while kastaid-ds shows global env config as a weaker pattern for a multi-chat bot. | current `src/index.ts`; current `src/services/chatSettings.service.ts`; kastaid-ds `ds/config.py:28-34` |
| Observability | Log source preview, model id, and edit result; do not log assembled conversation context because none exists. `evidence-backed` | Debug logging full context; logging source/translation bodies at info; tracing every Telegram history line | The translation path needs enough evidence to debug failures without leaking chat history. Removing context assembly also removes the most privacy-sensitive log surface. | current translation logging `src/services/translation.service.ts:38-39` |

Evidence quality: all §2 rows are `evidence-backed`; 0% `期望值估算`.

---

## §3 Directory structure

Top-level under `src/`: **4** entries. Routing stays in `bot/`; translation
prompt/call stays in `translate/`; settings stays in `settings/`; env parsing
stays in `config.ts`.

```text
src/
├── bot/                          # Telegram runtime + command effects — benchmark: mtcute packages/dispatcher/src/context
│   └── commands/                 # command handlers — benchmark: getter/getter/plugins
│       └── translate.ts          # inline source -> translate -> msg.edit, no history RPC — benchmark: getter/getter/plugins/translate.py
├── translate/                    # LLM translation path — benchmark: translation-agent/src/translation_agent/utils.py
│   └── service.ts                # translate(text, target): one completion, output-only prompt — benchmark: translation-agent utils.py:72
├── settings/                     # per-chat translation state — benchmark: in-repo src/services/chatSettings.service.ts
│   └── store.ts                  # get enabled/target for chat — benchmark: in-repo src/services/chatSettings.service.ts
└── config.ts                     # env-driven model/provider config — benchmark: kastaid-ds ds/config.py
```

The greenfield structure has no context builder package. Telegram history and
reply fetching are absent from the translation path.

---

## §4 Correspondence table

| Greenfield package | Benchmark source | Benchmark path | Correspondence |
|--------------------|------------------|----------------|----------------|
| `bot/commands/translate.ts` | getter (AGPL, design-only) | `/tmp/gf-refs/getter/getter/plugins/translate.py:66-103` | `tl` command selects source text, translates, then emits translated text without an explanatory wrapper. |
| `bot/commands/translate.ts` | mtcute (MIT) | `docs/reference/mtcute/packages/dispatcher/src/context/message.ts:92-95,193-200` | Reply fetching and editing are explicit methods; the target uses edit, rejects reply/history lookup in the immediate path. |
| `translate/service.ts` | translation-agent (MIT) | `~/.agents/refs/translation-agent/src/translation_agent/utils.py:72-97` | One-shot expert translation prompt with "nothing apart from the translation" output contract. |
| `translate/service.ts` | translation-agent (MIT) | `~/.agents/refs/translation-agent/src/translation_agent/utils.py:231-260,303-344` | Reflect/improve and document-context chunking are visible slower flows; they justify keeping those ideas out of this product path. |
| `settings/store.ts` | in-repo | `src/services/chatSettings.service.ts` | Current per-chat persistence is retained as the authority for enabled/target language. |
| `config.ts` | kastaid-ds (MIT) | `~/.agents/refs/kastaid-ds/ds/config.py:15-34` | Central env helper and typed config object; maps to `OAI_MODEL`, `OAI_BASE_URL`, and Telegram secrets. |

---

## §5 What this document is NOT

- **Not a migration plan.** No flags, no dual path, no rollback plan, no cutover
  schedule, no compatibility package.
- **Not an ADR.** It has only `active` or `superseded` status.
- **Not a model leaderboard.** Model ranking is an operational input. The
  architecture keeps `OAI_MODEL` configurable and keeps request count at one.
- **Not a second path design.** Current product scope has only `tl <text>`;
  there is no second translation path.

---

## §6 Adversarial review

Original target: define a benchmark-backed greenfield translation path that
improves speed and avoids context-induced mistranslation while preserving output
quality.

| Criterion | Blue claim | Red challenge | Lead result |
|-----------|------------|---------------|-------------|
| No hidden Telegram context RPC in the path | mtcute makes reply fetch explicit, and the removed feature's `getHistory`/`getReplyTo` calls were the context assembly points. Removing the context layer eliminates those RPCs. | Inline-only loses pronoun/register disambiguation for ambiguous replies. | PASS. The target is the product's only `tl <text>` translation path. User deployment evidence says default context misleads Gemini 2.5 Flash. |
| Translation quality has a replacement lever after context removal | translation-agent's one-shot prompt supports output-only expert translation; current prompt already carries transcreation and fidelity rules. | Context papers in the existing research packet supported chat context, so this reverses an earlier conclusion. | PASS. The stronger same-system evidence is the user's real deployment result. The parent §1a is explicitly narrowed by this supplement. |
| Performance improves in the metric the user cares about | One LLM request remains; removing `getHistory` and prompt context reduces Telegram RPC count and prompt tokens. | User said local eval time is not valuable when request count is the same; token reduction still changes provider latency/cost, but may not dominate. | PASS with residual risk. The guaranteed win is removing Telegram RPC and misleading context. Model latency remains controlled by `OAI_MODEL`. |
| Benchmark evidence is not overextended | translation-agent covers translation prompt flow; mtcute covers Telegram RPC/edit; getter/ds cover userbot command conventions. | No benchmark proves "context hurts" generically. | PASS. The document does not claim context hurts generically; it claims this product's translation path rejects context after production observation. |
| The document stays greenfield, not migration | §0 and §5 separate target from implementation; no flags or rollback language. | Mentioning current code line refs can drift into migration design. | PASS. Current code appears only as evidence for existing behavior and rejected alternatives. |

**Verdict: PASS.** The target is corrected to match the product: one translation
path, inline source, no context builder, one completion, one edit.

---

## §7 Labels

- **Migration honesty:** path exists; this document intentionally does not define
  it.
- **Disposable label:** this file defines the target state; implementation is a
  separate effort.
- **Next move:** `implemented directly` — context assembly is removed from
  `src/index.ts`; `TranslationService.translate` no longer accepts context.
